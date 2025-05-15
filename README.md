# Dialogflow Mutual Fund Services Bot - Webhook

This Node.js application serves as the webhook fulfillment backend for a Dialogflow agent designed to provide mutual fund related services via a chat interface (e.g., Telegram).

## Overview

The webhook handles various conversational flows, including:
- Welcoming users and presenting main service options.
- Allowing users to explore mutual fund categories and specific funds.
- Displaying details for selected funds.
- Facilitating a mock investment process for a chosen fund.
- Providing portfolio valuation based on user transactions.
- Showing transaction history for specified periods.
- Managing user sessions and context to guide conversations.

The application reads data from local JSON files for fund information and user transaction history.

## Features Implemented

* **Welcome & Main Menu**: Greets the user and offers main services: Portfolio Valuation, Explore Funds, Transaction History.
* **Explore Funds**:
    * Lists fund categories (Equity, Debt, Hybrid).
    * Lists funds within a selected category.
    * Shows details (ratio, CAGR, dummy link) for a selected fund.
* **Investment Flow**:
    * Initiated after viewing fund details.
    * Asks for contact number if not already in session.
    * Prompts for investment amount with quick suggestions (1000, 2000, 5000, 10000).
    * Validates the amount (must be a number; if typed, must be < 50,000).
    * Records the mock transaction (date, amount, fund name, fund ID, contact number) into `data/transactionhistorysample.json`.
* **Portfolio Valuation**:
    * Asks for contact number if not already in session.
    * Fetches unique fund IDs from the user's transaction history to represent their "portfolios".
    * Allows selection of a fund/portfolio.
    * Displays the total invested amount for the selected fund as its "valuation" based on `transactionhistorysample.json`.
* **Transaction History**:
    * Asks for contact number if not already in session.
    * Prompts user to select a period (Current Financial Year, Previous Financial Year, or custom date/range).
    * Filters transactions from `transactionhistorysample.json` based on the selected period.
    * Displays the latest 3 transactions for that period in a table-like format.
    * Asks the user if they want to invest more, potentially looping back to "Explore Funds".
* **Contact Number Management**:
    * Asks for a 10-digit contact number when required for services like Portfolio Valuation, Transaction History, or Investment if not already provided in the session.
    * Stores the validated contact number in a `user-session` context for reuse within the session.
* **Context Management**: Uses Dialogflow contexts to manage conversational state (e.g., `awaiting-category-selection`, `awaiting-fund-selection`, `awaiting-contact-number`, `awaiting-pv-fund-selection`, `awaiting-th-period-selection`, `awaiting-th-invest-decision`, `awaiting-investment-amount`).
* **Fallback Handling**: Basic fallback intent to catch unrecognized inputs.
* **Return to Main Menu**: A global option to reset the flow and return to the welcome message.

## Prerequisites

* Node.js (version 12.x or higher recommended)
* npm (Node Package Manager)
* A Dialogflow ES Agent configured to use this webhook for fulfillment.
* A messaging platform integration with Dialogflow (e.g., Telegram).
* A way to expose your local webhook to the internet for Dialogflow to reach it (e.g., ngrok during development).

## Project Structure

.├── data/│   ├── fund&categorysample.json  # Master data for fund categories and details│   └── transactionhistorysample.json # Stores user transactions (used for PV, TH, and investment recording)├── index.js                     # Main application file (Express server and webhook logic)├── package.json                 # Project dependencies and scripts├── package-lock.json            # Exact versions of dependencies└── README.md                    # This file
## Setup and Installation

1.  **Clone the repository (if applicable) or download the code.**
2.  **Navigate to the project directory:**
    ```bash
    cd path/to/your/project
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
    This will install `express`, `dialogflow-fulfillment`, `body-parser`, and any other necessary packages listed in `package.json`. (Note: `fs` and `path` are built-in Node.js modules).

4.  **Prepare Data Files:**
    * Ensure the `data` directory exists in the project root.
    * Place `fund&categorysample.json` with the correct fund structure inside the `data` directory.
    * Place `transactionhistorysample.json` (or ensure it will be created by the `recordTransaction` function) inside the `data` directory. The initial structure for `transactionhistorysample.json` should be an empty array `[]` or an array of user transaction objects as per the `recordTransaction` function's logic.

## Running the Webhook

1.  **Start the server:**
    ```bash
    node index.js
    ```
    By default, it will run on port 3000 (or the port specified by `process.env.PORT`). You should see a log: `Webhook running on port 3000`.

2.  **Expose your local webhook (for development):**
    * If you are running this locally, Dialogflow's cloud servers need a way to reach your machine. Use a tool like `ngrok`.
    * Install ngrok: [https://ngrok.com/download](https://ngrok.com/download)
    * Run ngrok to expose your local port (e.g., 3000):
        ```bash
        ngrok http 3000
        ```
    * ngrok will provide you with a public HTTPS URL (e.g., `https://xxxx-xx-xx-xx-xx.ngrok.io`).

3.  **Configure Dialogflow Fulfillment:**
    * Go to your Dialogflow ES Agent console.
    * Click on "Fulfillment" in the left menu.
    * Enable the "Webhook".
    * In the "URL" field, enter your public webhook URL (from ngrok or your deployed server URL) followed by `/webhook` (e.g., `https://xxxx-xx-xx-xx-xx.ngrok.io/webhook`).
    * Click "SAVE" at the bottom of the page.

## Data Files

* **`data/fund&categorysample.json`**:
    * Stores the master list of mutual fund categories and the funds within them, including details like `fund_id`, `fund_name`, `ratio`, `cagr`, and `details_link`.
    * This file is read at the start of the application.
* **`data/transactionhistorysample.json`**:
    * Stores user-specific transactions. Each entry typically contains a `mobile` number and an array of `transactions` (with `date`, `amount`, `fund_name`, `fund_id`).
    * This file is read and written to by the `recordTransaction` function (for investments) and read by portfolio valuation and transaction history features.

## Dialogflow Intent Integration (Key Intents)

The webhook `index.js` maps Dialogflow intent names to specific handler functions. You need to create corresponding intents in your Dialogflow agent:

* **`Default Welcome Intent`**: Triggers `defaultWelcomeIntent`.
* **`Default Fallback Intent`**: Triggers `defaultFallbackIntent`.
* **`Explore Funds`**: Triggers `exploreFundsIntent` (when user wants to see fund categories).
* **`Selected Fund Categories`**: Triggers `selectedFundCategoriesIntent` (handles `category_` callbacks). Requires input context `awaiting-category-selection`.
* **`Show Fund Details`**: Triggers `showFundDetailsIntent` (handles `fundchoice_` callbacks). Requires input context `awaiting-fund-selection`.
* **`Invoke Portfolio Valuation`**: Triggers `invokePortfolioValuationIntent`.
* **`Invoke Transaction History`**: Triggers `invokeTransactionHistoryIntent`.
* **`Capture Contact Number`**: Triggers `captureContactNumberIntent`. Requires input context `awaiting-contact-number` and uses `@sys.phone-number` entity.
* **`Show Selected Fund Portfolio`**: Triggers `showSelectedFundPortfolioIntent` (handles `portfolio_` callbacks for PV). Requires input context `awaiting-pv-fund-selection` and a custom Regexp entity.
* **`Handle Investment`**: Triggers `handleInvestmentIntent` (handles `invest_` callbacks). Requires a custom Regexp entity.
* **`Capture Investment Amount`**: Triggers `captureInvestmentAmountIntent`. Requires input context `awaiting-investment-amount` and uses `@sys.number` or direct query matching.
* **`Select Transaction History Period`**: Triggers `handleTHPeriodSelectionIntent`. Requires input context `awaiting-th-period-selection` and handles custom date entities (`@sys.date`, `@sys.date-period`) and period callbacks.
* **`Transaction History Invest Decision`**: Triggers `handleTHInvestDecisionIntent`. Requires input context `awaiting-th-invest-decision` and handles "yes/no" callbacks.
* **`Go To Main Menu`**: Triggers `goToMainMenuIntent` (handles `action_main_menu` callback).

Ensure that contexts, parameters, and entity usage in Dialogflow intents match what the webhook functions expect.

## Key Webhook Functions

* **`defaultWelcomeIntent`**: Initial interaction.
* **`exploreFundsIntent`**: Lists fund categories.
* **`selectedFundCategoriesIntent`**: Lists funds in a selected category.
* **`showFundDetailsIntent`**: Displays details of a specific fund.
* **`handleInvestmentIntent`**: Starts the investment flow, checks/asks for contact number.
* **`captureInvestmentAmountIntent`**: Captures and validates investment amount, records transaction.
* **`invokePortfolioValuationIntent`**: Starts portfolio valuation, checks/asks for contact number.
* **`displayPortfolioValuation` / `displayPortfolioFundChoices`**: Lists user's fund holdings for valuation.
* **`showSelectedFundPortfolioIntent`**: Shows valuation for a selected fund holding.
* **`invokeTransactionHistoryIntent`**: Starts transaction history, checks/asks for contact number.
* **`promptForTHPeriod`**: Asks user for the transaction history period.
* **`handleTHPeriodSelectionIntent`**: Processes period selection, filters, and displays transactions.
* **`handleTHInvestDecisionIntent`**: Handles user's choice after viewing transaction history.
* **`captureContactNumberIntent`**: Central handler for capturing and validating contact numbers for various flows.
* **`askForContactNumber`**: Helper to prompt for contact number and set context.
* **`getContactNumberFromSession`**: Helper to retrieve contact number from session context.
* **`recordTransaction`**: Saves investment data to `transactionhistorysample.json`.
* **`createTelegramPayload`**: Utility to format messages for Telegram.
* **`goToMainMenuIntent`**: Clears contexts and returns to the welcome message.
* **`defaultFallbackIntent`**: Handles unrecognized input.

## Context Management

The application heavily relies on Dialogflow contexts to manage the conversation flow. Key contexts include:
* `awaiting-category-selection`
* `awaiting-fund-selection`
* `awaiting-contact-number` (generic context for prompting phone number)
* `user-session` (stores validated contact number for the session)
* `awaiting-pv-fund-selection` (for portfolio valuation fund choice)
* `awaiting-th-period-selection` (for transaction history period choice)
* `awaiting-th-invest-decision`
* `awaiting-investment-amount`

Contexts are set with specific lifespans and often carry parameters (like `flow_type` or `fund_id`) to pass information between turns and intent handlers. They are cleared when a particular sub-flow is complete or when returning to the main menu.

---

This README should serve as a good starting point for understanding and running your project.
