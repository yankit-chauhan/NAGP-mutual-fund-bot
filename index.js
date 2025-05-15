const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());

const fundData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/fund&categorysample.json'), 'utf8'));
const transactionFilePath = path.join(__dirname, 'data/transactionhistorysample.json');

const AWAITING_CATEGORY_CHOICE_CONTEXT = 'awaiting-category-selection';
const AWAITING_FUND_CHOICE_CONTEXT = 'awaiting-fund-selection';
const AWAITING_CONTACT_NUMBER = 'awaiting-contact-number';
const USER_SESSION_CONTEXT = 'user-session';
const USER_SESSION_LIFESPAN = 50;
const CONTACT_NUMBER_LENGTH = 10;
const AWAITING_CONTACT_FOR_INVESTMENT_CONTEXT = 'awaiting-contact-for-investment';
const AWAITING_INVESTMENT_AMOUNT_CONTEXT = 'awaiting-investment-amount';
const AWAITING_PV_FUND_CHOICE_CONTEXT = 'awaiting-pv-fund-selection';
const AWAITING_TH_PERIOD_CONTEXT = 'awaiting-th-period-selection';
const AWAITING_TH_INVEST_DECISION_CONTEXT = 'awaiting-th-invest-decision';

const FUND_CATEGORY_CHOICE_PREFIX = 'category_';
const FUND_CHOICE_PREFIX = 'fundchoice_';
const PV_FUND_CHOICE_PREFIX = 'portfolio_';
const INVEST_CHOICE_PREFIX = 'invest_';
const ACTION_MAIN_MENU = 'action_main_menu';
const TH_PERIOD_CURRENT_FY_CALLBACK = 'th_period_current_fy';
const TH_PERIOD_PREVIOUS_FY_CALLBACK = 'th_period_previous_fy';
const TH_INVEST_YES_CALLBACK = 'th_invest_yes';
const TH_INVEST_NO_CALLBACK = 'th_invest_no';

app.post('/webhook', (req, res) => {

  const agent = new WebhookClient({ request: req, response: res });

  const defaultWelcomeIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const message = 'Hi, welcome to Mutual Fund Services. What service would you like to use?';
    const options = [
      [{ text: "Portfolio Valuation", callback_data: "Portfolio Valuation" }],
      [{ text: "Explore Funds", callback_data: "Explore Funds" }],
      [{ text: "Transaction History", callback_data: "Transaction History" }]
    ];
    agent.add(createTelegramPayload(message, options));
    console.log('----------------------------------------------------------------------------------');
  };

  const defaultFallbackIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    agent.add('Triggered from webhook: Something went wrong!');
    console.log('----------------------------------------------------------------------------------');
  }

  const exploreFundsIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const message = 'Kindly select one of the categories to see funds:';
    const categories = fundData.map(item => item.category);
    if (categories.length === 0) {
        agent.add("Sorry, no fund categories are available.");
        return;
    }
    const options = categories.map(category => ([{ text: category, callback_data: `${FUND_CATEGORY_CHOICE_PREFIX}${category}` }]));

    agent.add(createTelegramPayload(message, options));
    agent.context.set({ name: AWAITING_CATEGORY_CHOICE_CONTEXT, lifespan: 1 });
    console.log('----------------------------------------------------------------------------------');
  };

  const selectedFundCategoriesIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);

    const userChoice = agent.query;
    console.log('User Choice:', userChoice);

    if (!userChoice) {
      console.log("No effective user choice to process.");
      agent.add("I'm having trouble understanding your choice. Please try again from the menu.");
      agent.context.delete(AWAITING_CATEGORY_CHOICE_CONTEXT);
      return;
    }

    if (userChoice.startsWith(FUND_CATEGORY_CHOICE_PREFIX)) {
      const selectedCategory = userChoice.substring(FUND_CATEGORY_CHOICE_PREFIX.length);
      console.log('Selected Fund Category:', selectedCategory);

      const categoryObject = fundData.find(item => item.category === selectedCategory);
      const funds = categoryObject.funds;

      if (funds && funds.length > 0) {
        const message = `Select one of the below funds from ${selectedCategory}:`;
        const options = funds.map(fund => ([{ text: fund.fund_name, callback_data: `${FUND_CHOICE_PREFIX}${fund.fund_id}` }]));
        agent.add(createTelegramPayload(message, options));
        agent.context.set({ name: AWAITING_FUND_CHOICE_CONTEXT, lifespan: 1 });
      } else {
        agent.add(`Sorry, no funds found for the category: ${selectedCategory}. Please pick another category.`);
        agent.context.delete(AWAITING_CATEGORY_CHOICE_CONTEXT);
      }
    } else {
      console.log("Unhandled userChoice structure:", userChoice);
      agent.add("I'm not sure what to do with that selection. Please try an option from the main menu.");
      agent.context.delete(AWAITING_CATEGORY_CHOICE_CONTEXT);
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const showFundDetailsIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);

    const userChoice = agent.query;
    console.log('User Choice:', userChoice);


    if (!userChoice) {
        console.log("Invalid or no fund data received:", userChoice);
        agent.add("I couldn't determine which fund you selected. Please try again.");
        agent.context.delete(AWAITING_FUND_CHOICE_CONTEXT);
        return;
    }

    const selectedFundId = userChoice.substring(FUND_CHOICE_PREFIX.length);
    let selectedFundName = `ID ${selectedFundId}`;
    let fundRatio = "Not available";
    let fundCagr = "Not available";
    let fundDetailsLink = "https://www.example-data.com/general-info";
    let fundFound = false;

    try {
      for (const categoryEntry of fundData) {
        const foundFund = categoryEntry.funds.find(f => f.fund_id === selectedFundId);
        if (foundFund) {
          selectedFundName = foundFund.fund_name || selectedFundName;
          fundRatio = foundFund.ratio || fundRatio;
          fundCagr = foundFund.cagr || fundCagr;
          fundDetailsLink = foundFund.details_link || fundDetailsLink;
          fundFound = true;
          break;
        }
      }
    } catch (error) {
      console.error("Error reading fund data file or finding fund:", error);
      agent.add("Sorry, there was an issue fetching the fund details.");
      agent.context.delete(AWAITING_FUND_CHOICE_CONTEXT);
      return;
    }
    console.log('Selected Fund ID:', selectedFundId, "Name:", selectedFundName);

    const message = `Selected Fund: ${selectedFundName} (ID: ${selectedFundId})\n\nIt has a ratio of approximately ${fundRatio} with a ${fundCagr}% CAGR.\n\nFor more details: ${fundDetailsLink}`;
    const options = [
      [{ text: "Invest", callback_data: `${INVEST_CHOICE_PREFIX}${selectedFundId}` }],
      [{ text: "Return to Main menu", callback_data: "action_main_menu" }]
    ];
    agent.add(createTelegramPayload(message, options));
    agent.context.delete(AWAITING_FUND_CHOICE_CONTEXT);
    console.log('----------------------------------------------------------------------------------');
  };

  const captureContactNumberIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const contactNumber = agent.parameters.contact_number_input;

    const activeContext = agent.context.get(AWAITING_CONTACT_NUMBER);
    const flowType = activeContext?.parameters?.flow_type;

    console.log('Contact Number:', contactNumber, 'Flow type:', flowType);

    if (contactNumber && contactNumber.length === CONTACT_NUMBER_LENGTH) {
        agent.context.set({
            name: USER_SESSION_CONTEXT,
            lifespan: USER_SESSION_LIFESPAN,
            parameters: { contact_number: contactNumber }
        });
        console.log(`CCN Intent - Stored ${contactNumber} in context: ${USER_SESSION_CONTEXT}`);
        agent.context.delete(AWAITING_CONTACT_NUMBER);
        const contextParams = activeContext?.parameters || {};
        console.log('flowType:', flowType);
        if (flowType === "Portfolio Valuation") {
          displayPortfolioValuation(agent, contactNumber);
        } else if (flowType === "Transaction History") {
          promptForTHPeriod(agent, contactNumber);
        } else if (flowType === "Invest" || contextParams.fund_id_for_investment) {
          const fundId = contextParams.fund_id_for_investment;
          const fundName = contextParams.fund_name_for_investment || `Fund ID ${fundId}`;
          if (fundId) {
              console.log(`CCN Intent - Proceeding to investment amount for fund: ${fundId}`);
              promptForInvestmentAmount(agent, fundId, contactNumber, fundName);
          } else {
              console.warn('CCN Intent - Investment flow triggered, but fund_id missing from context params.');
              agent.add("Something went wrong with the investment flow. Please try selecting the fund again.");
          }
        } else {
            console.warn('CCN Intent - Unknown flow_type:', flowType);
            agent.add("Contact number captured, but I'm unsure of the next step. Please try again from the main menu.");
        }
    } else {
        agent.add("Validation Error: Contact number must be 10 digits only. Please enter a valid contact number.");
        if (activeContext && flowType) {
             agent.context.set({
                name: AWAITING_CONTACT_NUMBER,
                lifespan: 1,
                parameters: { flow_type: flowType }
            });
        } else {
            agent.context.delete(AWAITING_CONTACT_NUMBER);
            agent.add("Please try selecting Portfolio Valuation or Transaction History again.");
        }
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const handleInvestmentIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const investPayload = agent.parameters.invest_payload || agent.query;
    console.log('INVEST_FLOW - Payload:', investPayload);

    if (!investPayload || !investPayload.startsWith(INVEST_CHOICE_PREFIX)) {
      agent.add("Sorry, I couldn't identify the fund for investment. Please try again.");
      return;
    }
    const fundId = investPayload.substring(INVEST_CHOICE_PREFIX.length);
    console.log('INVEST_FLOW - Extracted Fund ID:', fundId);

    let fundName = `Fund ID ${fundId}`;
    try {
      for (const categoryEntry of fundData) {
          const foundFund = categoryEntry.funds.find(f => f.fund_id === fundId);
          if (foundFund) {
              fundName = foundFund.fund_name;
              break;
          }
      }
    } catch(e){ console.error("Error finding fund name in handleInvestmentIntent", e)}


    const contactNumber = getContactNumberFromSession(agent);
    if (contactNumber) {
      console.log('INVEST_FLOW - Contact number found in session:', contactNumber);
      promptForInvestmentAmount(agent, fundId, contactNumber, fundName);
    } else {
      console.log('INVEST_FLOW - Contact number not found. Asking user.');
      agent.context.set({
        name: AWAITING_CONTACT_FOR_INVESTMENT_CONTEXT,
        lifespan: 1,
        parameters: { fund_id_for_investment: fundId, fund_name_for_investment: fundName }
      });
      askForContactNumber(agent, "Invest", {
        fund_id_for_investment: fundId,
        fund_name_for_investment: fundName
      });
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const captureInvestmentAmountIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const contextParams = agent.context.get(AWAITING_INVESTMENT_AMOUNT_CONTEXT)?.parameters;
    const fundId = contextParams?.fund_id;
    const contactNumber = contextParams?.contact_number;
    const fundName = contextParams?.fund_name || `Fund ID ${fundId}`;

    let amountInput = agent.parameters.amount || agent.query;
    console.log('INVEST_AMOUNT - Raw amount input:', amountInput);

    if (!fundId || !contactNumber) {
      console.error('INVEST_AMOUNT - Missing fund_id or contact_number in context.');
      agent.add("Sorry, something went wrong with your investment selection. Please try again from the fund details.");
      agent.context.delete(AWAITING_INVESTMENT_AMOUNT_CONTEXT);
      return;
    }

    let amount = parseFloat(String(amountInput).replace(/[^0-9.]/g, ''));

    let isValid = false;
    let errorMessage = "";

    if (isNaN(amount) || amount <= 0) {
      errorMessage = "Please enter a valid positive number for the amount.";
    } else {
      const chipValues = ["1000", "2000", "5000", "10000"];
      const wasChipClicked = chipValues.includes(String(amountInput));

      if (wasChipClicked) {
        isValid = true;
      } else if (amount < 50000) {
        isValid = true;
      } else {
        errorMessage = "If typing an amount, it must be less than ₹50,000. Please enter a valid amount or select an option.";
      }
    }

    if (isValid) {
      console.log(`INVEST_AMOUNT - Valid amount: ${amount} for fund: ${fundId}, contact: ${contactNumber}`);
      const transaction = {
        date: new Date().toISOString().split('T')[0],
        contact_number: contactNumber,
        fund_name: fundName,
        fund_id: fundId,
        amount: amount
      };
      if (recordTransaction(transaction)) {
        agent.add("Thank you for choosing our services. Your investment has been recorded.");
      } else {
        agent.add("Thank you for choosing our services. There was an issue recording your investment, please contact support.");
      }
      agent.context.delete(AWAITING_INVESTMENT_AMOUNT_CONTEXT);
      defaultWelcomeIntent(agent);

    } else {
      console.log('INVEST_AMOUNT - Invalid amount entered.');
      agent.add(errorMessage);
      promptForInvestmentAmount(agent, fundId, contactNumber, fundName);
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const invokePortfolioValuationIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);
    const contactNumber = getContactNumberFromSession(agent);
    if (contactNumber) {
      displayPortfolioValuation(agent, contactNumber);
    } else {
      askForContactNumber(agent, "Portfolio Valuation");
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const showSelectedFundPortfolioIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('Triggered:', agent.intent);

    const userChoice = agent.query;
    console.log('User Choice:', userChoice);


    if (!userChoice) {
        console.log("Invalid or no fund data received:", userChoice);
        agent.add("I couldn't determine which fund you selected. Please try again.");
        agent.context.delete(AWAITING_PV_FUND_CHOICE_CONTEXT);
        return;
    }

    const selectedFundId = userChoice.substring(PV_FUND_CHOICE_PREFIX.length);
    console.log('selectedFundId', selectedFundId);

    if (fs.existsSync(transactionFilePath)) {
      const fileData = fs.readFileSync(transactionFilePath, 'utf8');
      if (fileData) {
        records = JSON.parse(fileData);
      }
    }

    const contactNumber = getContactNumberFromSession(agent);
    let userRecord = records.find(user => user.mobile === contactNumber);

    let matchingTransactions = [];

    if (userRecord) {
      matchingTransactions = userRecord.transactions.filter(
        transaction => transaction.fund_id === selectedFundId
      );
      const totalAmount = matchingTransactions.reduce((sum, txn) => sum + txn.amount, 0);
      const currDate = new Date().toISOString().split('T')[0];
      agent.add(`Your Portfolio ${selectedFundId} valuation is ${totalAmount} on ${currDate}`);
    }
    agent.context.delete(AWAITING_PV_FUND_CHOICE_CONTEXT);

    console.log('----------------------------------------------------------------------------------');
  }

  const invokeTransactionHistoryIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('InvokeTH Intent - Triggered:', agent.intent);
    const contactNumber = getContactNumberFromSession(agent);
    if (contactNumber) {
      promptForTHPeriod(agent, contactNumber);
    } else {
      askForContactNumber(agent, "Transaction History");
    }
    console.log('----------------------------------------------------------------------------------');
  };

  const handleTHPeriodSelectionIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('TH_PERIOD_SELECT Intent - Triggered:', agent.intent);
    const periodSelection = agent.query;
    const thPeriodContext = agent.context.get(AWAITING_TH_PERIOD_CONTEXT);
    const contactNumber = thPeriodContext?.parameters?.contact_number;

    console.log('TH_PERIOD_SELECT Intent - Period:', periodSelection, "Contact:", contactNumber);

    if (!contactNumber) {
        agent.add("Sorry, your session seems to have expired. Please start over by selecting Transaction History again.");
        if (thPeriodContext) agent.context.delete(AWAITING_TH_PERIOD_CONTEXT);
        return;
    }

    let allUserTransactions = [];
    try {
        if (fs.existsSync(transactionFilePath)) {
            const fileData = fs.readFileSync(transactionFilePath, 'utf8');
            if (fileData) {
                allUserTransactions = JSON.parse(fileData);
                if (!Array.isArray(allUserTransactions)) {
                    console.error("Transaction data is not an array. Resetting.");
                    allUserTransactions = [];
                }
            }
        }
    } catch (e) {
        console.error("Error reading transaction file for TH:", e);
        agent.add("Sorry, an error occurred while fetching transaction history.");
        if (thPeriodContext) agent.context.delete(AWAITING_TH_PERIOD_CONTEXT);
        return;
    }

    const userRecord = allUserTransactions.find(u => u.mobile === contactNumber);
    let userTransactions = [];
    if (userRecord && userRecord.transactions && Array.isArray(userRecord.transactions)) {
        userTransactions = userRecord.transactions;
    }

    let transactionsToDisplay = [];
    let periodText = "";

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let fyStartYear;
    if (currentMonth >= 3) {
        fyStartYear = currentYear;
    } else {
        fyStartYear = currentYear - 1;
    }

    let startDate, endDate;

    if (periodSelection === TH_PERIOD_CURRENT_FY_CALLBACK) {
        periodText = "Current Financial Year";
        startDate = new Date(fyStartYear, 3, 1);
        endDate = new Date(fyStartYear + 1, 2, 31);
    } else if (periodSelection === TH_PERIOD_PREVIOUS_FY_CALLBACK) {
        periodText = "Previous Financial Year";
        startDate = new Date(fyStartYear - 1, 3, 1);
        endDate = new Date(fyStartYear, 2, 31);
    } else {
        agent.add("Invalid period selection. Please choose a valid period.");
        promptForTHPeriod(agent, contactNumber);
        return;
    }

    console.log(`Filtering for ${periodText}: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    transactionsToDisplay = userTransactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= startDate && txnDate <= endDate;
    });

    transactionsToDisplay.sort((a, b) => new Date(b.date) - new Date(a.date));

    const latestThreeTransactions = transactionsToDisplay.slice(0, 3);

    if (latestThreeTransactions.length > 0) {
        let tableString = "```\n";
        tableString += "Date                | Fund Name                    | Amount        |\n";
        tableString += "----------------------|---------------------------------------|---------------|\n";

        latestThreeTransactions.forEach(txn => {
            const dateStr = (txn.date || 'N/A').padEnd(15);
            const fundStr = (txn.fund_name || 'N/A').substring(0, 18).padEnd(25);
            const amountStr = `₹${(txn.amount || 0).toLocaleString('en-IN')}`.padStart(15);

            tableString += `${dateStr} | ${fundStr} | ${amountStr} |\n`;
        });
        tableString += "```";

        const message = `Latest 3 transactions for ${contactNumber} (${periodText}):\n${tableString}`;
        agent.add(message);
    } else {
        agent.add(`No transactions found for ${contactNumber} for the selected period: ${periodText}.`);
    }

    if (thPeriodContext) agent.context.delete(AWAITING_TH_PERIOD_CONTEXT);

    const investMoreMessage = "Do you want to invest more?";
    const options = [
        [{ text: "Yes", callback_data: TH_INVEST_YES_CALLBACK }],
        [{ text: "No", callback_data: TH_INVEST_NO_CALLBACK }]
    ];
    agent.add(createTelegramPayload(investMoreMessage, options));
    agent.context.set({
        name: AWAITING_TH_INVEST_DECISION_CONTEXT,
        lifespan: 1,
        parameters: { contact_number: contactNumber }
    });
    console.log('----------------------------------------------------------------------------------');
  };

  const handleTHInvestDecisionIntent = agent => {
    console.log('----------------------------------------------------------------------------------');
    console.log('TH_INVEST_DECISION Intent - Triggered:', agent.intent);
    const decision = agent.query;
    const decisionContext = agent.context.get(AWAITING_TH_INVEST_DECISION_CONTEXT);
    const contactNumber = decisionContext?.parameters?.contact_number || getContactNumberFromSession(agent);


    if (decision === TH_INVEST_YES_CALLBACK) {
        agent.add("Great! Let's find some funds for you.");
        agent.context.delete(AWAITING_TH_INVEST_DECISION_CONTEXT);
        return exploreFundsIntent(agent);
    } else if (decision === TH_INVEST_NO_CALLBACK) {
        agent.add("Thank you for using our services!");
        agent.context.delete(AWAITING_TH_INVEST_DECISION_CONTEXT);
    } else {
        agent.add("Sorry, I didn't understand that. Please choose Yes or No.");
        const investMoreMessage = "Do you want to invest more?";
        const options = [
            [{ text: "Yes", callback_data: TH_INVEST_YES_CALLBACK }],
            [{ text: "No", callback_data: TH_INVEST_NO_CALLBACK }]
        ];
        agent.add(createTelegramPayload(investMoreMessage, options));
        agent.context.set({name: AWAITING_TH_INVEST_DECISION_CONTEXT, lifespan: 1, parameters: {contact_number: contactNumber}});
    }
    console.log('----------------------------------------------------------------------------------');
  };


  agent.handleRequest(createIntentMap());

  // HELPER FUNCTIONS

  function recordTransaction( transactionData ) {
    try {
      let records = [];
      if (fs.existsSync(transactionFilePath)) {
        const fileData = fs.readFileSync(transactionFilePath, 'utf8');
        if (fileData) {
          records = JSON.parse(fileData);
        }
      }
      const userMobile = transactionData.contact_number;
      const transactionEntry = {
        date: transactionData.date,
        amount: transactionData.amount,
        fund_name: transactionData.fund_name,
        fund_id: transactionData.fund_id
      };

      let userRecord = records.find(user => user.mobile === userMobile);

      if (userRecord) {
        if (!Array.isArray(userRecord.transactions)) {
            userRecord.transactions = [];
        }
        userRecord.transactions.push(transactionEntry);
        console.log(`Transaction added for existing user: ${userMobile}`);
      } else {
        records.push({
          mobile: userMobile,
          transactions: [transactionEntry]
        });
        console.log(`New user record created and transaction added for: ${userMobile}`);
      }

      fs.writeFileSync(transactionFilePath, JSON.stringify(records, null, 2), 'utf8');
      console.log('User records data updated successfully.');
      return true;
    } catch (error) {
      console.error('Error recording transaction to transactionhistorysample.json:', error);
      return false;
    }

  }

  function promptForInvestmentAmount(agent, fundId, contactNumber, fundName = 'Selected Fund') {
    console.log(`PROMPT_INVEST_AMOUNT - For fundId: ${fundId}, contact: ${contactNumber}`);
    const message = `Investing in: ${fundName}.\nPlease enter the amount in Rupees you wish to invest.`;
    const quickSuggestions = [
      [{ text: "₹1000", callback_data: "1000" }],
      [{ text: "₹2000", callback_data: "2000" }],
      [{ text: "₹5000", callback_data: "5000" }],
      [{ text: "₹10000", callback_data: "10000" }]
    ];
    agent.add(createTelegramPayload(message, quickSuggestions));
    agent.context.set({
      name: AWAITING_INVESTMENT_AMOUNT_CONTEXT,
      lifespan: 1,
      parameters: { fund_id: fundId, contact_number: contactNumber, fund_name: fundName }
    });
    console.log(`PROMPT_INVEST_AMOUNT - Set context: ${AWAITING_INVESTMENT_AMOUNT_CONTEXT}`);
  }

  function createTelegramPayload( message, options ) {
    const telegramPayload = {
      telegram: {
        text: message,
        reply_markup: {
          inline_keyboard: options
        }
      }
    };
    return new Payload(agent.TELEGRAM, telegramPayload, { sendAsMessage: true, rawPayload: true });
  }

  function getContactNumberFromSession( agent ) {
    const userSession = agent.context.get(USER_SESSION_CONTEXT);
    if (userSession && userSession.parameters && userSession.parameters.contact_number) {
      const contact = String(userSession.parameters.contact_number).replace(/\D/g, '');
      if (contact.length === CONTACT_NUMBER_LENGTH) {
        return contact;
      }
    }
    return null;
  }

  function askForContactNumber(agent, serviceName, nextStepDetails = {}) {
    const message = `Kindly enter your 10-digit registered contact number to proceed with ${serviceName}.`;
    agent.add(createTelegramPayload(message, []));
    agent.context.set({
        name: AWAITING_CONTACT_NUMBER,
        lifespan: 2,
        parameters: {
          flow_type: serviceName,
          ...nextStepDetails
        }
    });
    console.log(`ASK_CONTACT - Set context: ${AWAITING_CONTACT_NUMBER} for flow: ${serviceName}`);
  }

  function displayPortfolioValuation( agent, contactNumber ) {
    console.log(`For contact: ${contactNumber}`);

    if (fs.existsSync(transactionFilePath)) {
      const fileData = fs.readFileSync(transactionFilePath, 'utf8');
      if (fileData) {
        records = JSON.parse(fileData);
      }
    }

    let userRecord = records.find(user => user.mobile === contactNumber);

    if (userRecord && userRecord.transactions && userRecord.transactions.length > 0) {
      console.log(`Record exists for user: ${contactNumber}`);
      const message = `Kindly select one of your portfolios.`;
      const uniqueFundIds = new Set(userRecord.transactions.map(txn => txn.fund_id));
      const options = Array.from(uniqueFundIds).map(fund_id => ([{ text: fund_id, callback_data: `${PV_FUND_CHOICE_PREFIX}${fund_id}` }]));
      console.log(JSON.stringify(options));
      agent.add(createTelegramPayload(message, options));
      agent.context.set({ name: AWAITING_PV_FUND_CHOICE_CONTEXT, lifespan: 1 });
    } else {
      console.log(`No Record exists for user: ${contactNumber}`);
      const message = `No Record Exists for the user with mobile number: ${contactNumber}. \nWhat would you like to do next?`;
      const options = [[
        { text: "Invest", callback_data: ACTION_MAIN_MENU },
        { text: "Return to Main menu", callback_data: ACTION_MAIN_MENU }]];
      agent.add(createTelegramPayload(message, options));
    }
  }

  function promptForTHPeriod( agent, contactNumber ) {
    console.log(`For contact: ${contactNumber}`);
    const message = "Kindly provide a time period.";
    const options = [
      [{ text: "Current Financial Year", callback_data: TH_PERIOD_CURRENT_FY_CALLBACK }],
      [{ text: "Previous Financial Year", callback_data: TH_PERIOD_PREVIOUS_FY_CALLBACK }]
    ];
    agent.add(createTelegramPayload(message, options));agent.context.set({
      name: AWAITING_TH_PERIOD_CONTEXT,
      lifespan: 1,
      parameters: { contact_number: contactNumber }
    });
  }

  function createIntentMap() {
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', defaultWelcomeIntent);
    intentMap.set('Default Fallback Intent', defaultFallbackIntent);

    intentMap.set('Explore Funds', exploreFundsIntent);
    intentMap.set('Selected Fund Categories', selectedFundCategoriesIntent);
    intentMap.set('Show Fund Details', showFundDetailsIntent);
    intentMap.set('Handle Investment', handleInvestmentIntent);
    intentMap.set('Capture Investment Amount', captureInvestmentAmountIntent);

    intentMap.set('Capture Contact Number', captureContactNumberIntent);

    intentMap.set('Invoke Portfolio Valuation', invokePortfolioValuationIntent);
    intentMap.set('Show Selected Fund Portfolio', showSelectedFundPortfolioIntent);

    intentMap.set('Invoke Transaction History', invokeTransactionHistoryIntent);
    intentMap.set('Select Transaction History Period', handleTHPeriodSelectionIntent);
    intentMap.set('Transaction History Invest Decision', handleTHInvestDecisionIntent);

    return intentMap;
  }

});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook running on port ${port}`));