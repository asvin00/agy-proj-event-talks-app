import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, render_template_string
import os

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data to avoid rate limits and improve speed
feed_cache = {
    "data": None,
    "last_fetched": None
}

def clean_html(html_str):
    """Clean HTML content, format links to open in new tab and prepend base domain if needed."""
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
        href = a.get('href', '')
        if href.startswith('/'):
            a['href'] = 'https://cloud.google.com' + href
    return str(soup)

def get_plain_text(html_str):
    """Convert HTML content to plain text, formatting links nicely for sharing/tweeting."""
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, 'html.parser')
    
    # Replace list items with bullet points
    for li in soup.find_all('li'):
        li.insert_before('\n- ')
        
    # Replace links with text (URL) format
    for a in soup.find_all('a'):
        link_text = a.get_text().strip()
        href = a.get('href', '')
        if href and not href.startswith('#'):
            # Avoid repeating the link if it's already the text
            if link_text.lower() in href.lower() or href.lower() in link_text.lower():
                a.replace_with(href)
            else:
                a.replace_with(f"{link_text} ({href})")
                
    # Get text and clean double newlines
    text = soup.get_text()
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return "\n".join(lines)

def fetch_and_parse_feed():
    """Fetches the Google BigQuery release notes XML and parses it into granular updates."""
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_content = response.content
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Return fallback or raise
        raise e

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        print(f"XML Parsing Error: {e}")
        raise e

    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    updates = []
    
    # Iterate through each <entry> (representing a date of release notes)
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns)
        date_str = title.text.strip() if title is not None else "Unknown Date"
        
        updated = entry.find('atom:updated', ns)
        updated_val = updated.text.strip() if updated is not None else ""
        
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        entry_link = link_elem.attrib['href'] if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        if content_elem is not None and content_elem.text:
            html_content = content_elem.text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Google's release notes feed groups multiple updates under one entry (date).
            # The structure uses <h3> tags to denote categories (e.g. Feature, Issue, Change)
            # followed by paragraphs <p> or lists <ul> containing the details.
            current_category = "Feature"  # default fallback
            current_blocks = []
            
            # Helper to append a parsed update
            def add_update(cat, blocks, idx):
                if not blocks:
                    return
                html_snippet = "".join(str(b) for b in blocks).strip()
                cleaned_html = clean_html(html_snippet)
                plain_text = get_plain_text(html_snippet)
                
                # Make a unique ID for selection/tweeting
                date_id = date_str.replace(",", "").replace(" ", "_")
                update_id = f"{date_id}_{idx}"
                
                updates.append({
                    'id': update_id,
                    'date': date_str,
                    'updated': updated_val,
                    'link': entry_link,
                    'category': cat,
                    'html': cleaned_html,
                    'text': plain_text
                })

            update_idx = 0
            # Iterate through children of HTML body to split by <h3>
            for child in soup.contents:
                if child.name == 'h3':
                    # Save the previous update block we gathered
                    if current_blocks:
                        add_update(current_category, current_blocks, update_idx)
                        update_idx += 1
                        current_blocks = []
                    current_category = child.get_text().strip()
                else:
                    # Collect content elements (p, ul, etc.)
                    # Ignore empty string elements
                    if str(child).strip():
                        current_blocks.append(child)
            
            # Add the final update block in this entry
            if current_blocks:
                add_update(current_category, current_blocks, update_idx)
                
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    try:
        updates = fetch_and_parse_feed()
        feed_cache["data"] = updates
        return jsonify({
            "status": "success",
            "count": len(updates),
            "updates": updates
        })
    except Exception as e:
        # If fetch fails but we have cached data, return the cached data with a warning
        if feed_cache["data"]:
            return jsonify({
                "status": "warning",
                "message": f"Could not fetch live feed. Showing cached data. Error: {str(e)}",
                "count": len(feed_cache["data"]),
                "updates": feed_cache["data"]
            })
        
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch and parse release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
