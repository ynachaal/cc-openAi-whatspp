# WhatsApp Real Estate Message Analyzer

This project is a WhatsApp bot that listens for incoming messages, analyzes informal real estate listings, and converts them into structured JSON data. The extracted data can be sent to a Google Sheet for further processing or record-keeping.

## Features
- Parses WhatsApp messages about real estate (buy, sell, rent)
- Extracts structured data such as property type, location, price, status, etc.
- **Smart message filtering**: Automatically skips very short messages and non-real estate content
- **AI-powered filtering**: Uses advanced AI to distinguish real estate messages from general conversation
- Detects and handles non-real-estate messages
- Uses Google Gemini Flash 2 LLM via LangChain for robust message understanding

## Message Filtering

The bot includes intelligent filtering to process only relevant real estate messages:

### 1. Length Filtering
- Messages shorter than 30 characters are automatically skipped
- Configurable via `MIN_MESSAGE_LENGTH` constant in the code

### 2. AI-Powered Analysis
- All messages that pass length filtering are analyzed by the AI agent
- The AI uses strict rules to identify real estate messages vs. general conversation
- Only confirmed real estate messages are sent to Google Sheets

### Examples of Filtered Messages:
- ❌ "Hello, how are you?" (greeting)
- ❌ "Thanks for sharing" (social response)
- ❌ "Any updates?" (too vague)
- ❌ "Ok" (too short)
- ❌ "Looking for property" (vague inquiry)
- ❌ "Available?" (non-specific)
- ✅ "Marina 2BR apartment for rent 120K" (clear real estate content)
- ✅ "Studio for sale in JLT, 450 sqft, asking 580K" (specific property details)

## Prerequisites
- Node.js (v18 or later recommended)
- npm or yarn
- WhatsApp account for bot integration
- Google Gemini API key
- **Google Service Account for Sheets integration**

## Setup
1. **Add the WhatsApp bot to a group:**
   - Add your WhatsApp bot account (the one running on Venom) to the desired WhatsApp group.

2. **Find the group ID and add it to your `.env`:**
   - Use Venom or your bot logs to find the group ID (it will look like `1234567890-1234567890@g.us`).
   - Add this to your `.env` file as:
     ```env
     WHATSAPP_NUMBER=your_group_id@g.us
     ```

3. **Set up Google Service Account and credentials:**
   - Follow the steps in the **Google Sheets Integration Setup** section above to create a service account, generate a JSON key, and share your Google Sheet with the service account email.
   - Add the following to your `.env` file:
     ```env
     GOOGLE_CLIENT_EMAIL=your_service_account_email
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
     GOOGLE_SHEET_ID=your_google_sheet_id
     GOOGLE_API_KEY=your_google_gemini_api_key
     ```

4. **Install dependencies and start the project:**
   ```bash
   yarn install
   yarn dev
   # or
   yarn build
   yarn start
   ```

## Google Sheets Integration Setup
1. **Create a Google Service Account:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com).
   - Click on "Manage service accounts" or navigate to IAM & Admin > Service Accounts.
   - Click "Create Service Account", give it a name, and click "Create and Continue".
   - Grant the "Editor" role (or at least "Writer" access).
   - Click "Done".

2. **Generate a JSON Key:**
   - In the Service Accounts list, click on your new service account.
   - Go to the "Keys" tab.
   - Click "Add Key" > "Create new key" > Choose "JSON" > "Create".
   - Download the JSON file and keep it safe.

3. **Set up your `.env` file:**
   - Open the JSON file and copy the values for `client_email` and `private_key`.
   - Add these to your `.env` file:
     ```env
     GOOGLE_CLIENT_EMAIL=your_service_account_email
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0B...\n-----END PRIVATE KEY-----\n"
     GOOGLE_SHEET_ID=your_google_sheet_id
     ```
   - Make sure to share your Google Sheet with the service account email address (the `client_email`).

## How It Works
- The bot listens for incoming WhatsApp messages.
- When a message is received, it is sent to a LangChain agent powered by Gemini Flash 2.
- The agent parses the message and returns structured JSON data if it is a real estate message.
- If the message is not related to real estate, a clear response is returned.
- The structured data is sent to a Google Sheet for record-keeping.