# BigQuery Release Notes Hub 🚀

A modern, responsive web application that aggregates, parses, and segments BigQuery Release Notes from Google Cloud's Atom Feed. Built using **Python Flask** on the backend and **vanilla HTML5, CSS3, and JavaScript** on the frontend, it enables developers to browse, search, filter, select, and compose custom character-counted posts to share directly on X (Twitter).

---

## 🌟 Key Features

* **Granular Release Segmenting**: Google groups daily release notes into single entries. The application splits these consolidated logs by category (`Feature`, `Change`, `Breaking`, `Issue`, `Announcement`) into individual, focusable cards.
* **Interactive Statistics & Filtering**: A dashboard at the top tracks totals for each category. Clicking these cards or using the filter pills instantly updates the timeline view.
* **Smart Search**: Real-time local search filters the release cards by keyword, category, or date.
* **Multi-Select Selection Engine**: Checkboxes on each card let you select multiple updates. A floating action bar slides up from the bottom of the screen to draft a combined bulleted tweet for all selected items.
* **Character-Counted X (Twitter) Composer**: A modal overlay styled like X's publisher checks text length (max 280 characters).
  * **⚡ Auto-Shorten**: Automatically truncates descriptions to fit the character limit while keeping the category emoji and source link intact.
  * **🔗 Link Only**: Strips descriptions, leaving just the category tag, date, and source link.

---

## 🛠️ Tech Stack

* **Backend**: Python 3, Flask, Requests, BeautifulSoup4 (for parsing and sanitizing feed content).
* **Frontend**: Vanilla HTML5, CSS3 (featuring glassmorphism, responsive grid layouts, custom checkboxes, and animations), and Vanilla ES6 JavaScript (handling UI state, counter animations, search filters, and Twitter integration).

---

## 📂 Directory Structure

```text
bq-releases-notes/
├── static/
│   ├── css/
│   │   └── styles.css      # Custom glassmorphic styles, responsive grids, and animations
│   └── js/
│       └── app.js          # Client state controller, AJAX sync, search & tweet managers
├── templates/
│   └── index.html          # Main application page layout & composer modal
├── .gitignore              # Ignores pycache, virtual envs, logs, and IDE configs
├── app.py                  # Flask application & feed parsing pipeline
├── README.md               # Project documentation
└── requirements.txt        # Python dependency list
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have Python 3 and Git installed on your system.

### Installation

1. **Clone the Repository**:
   ```bash
   git clone -b def https://github.com/asvin00/agy-proj-event-talks-app.git
   cd agy-proj-event-talks-app
   ```

2. **Install Dependencies**:
   ```bash
   python -m pip install -r requirements.txt
   ```

3. **Run the Development Server**:
   ```bash
   python app.py
   ```

4. **Access the App**:
   Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.

---

## 🔄 How the Parser Works

1. **Fetches**: Downloads the live Atom feed from `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
2. **Splits**: Parses the raw XML nodes. When it reads the HTML body, it uses **BeautifulSoup** to split content nodes based on `<h3>` headers.
3. **Cleanses**: Resolves relative links to absolute Google Cloud documentation URLs and configures anchors to open in new browser tabs securely (`target="_blank"`).
4. **Drafts**: Strips HTML tags to produce pre-formatted plain text bullet lists for draft tweets.

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).
