// Import required modules
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB database
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
  });

// Create a mongoose schema for the entry model
const accountSchema = new mongoose.Schema({
  beneName: {
    type: String,
    required: true,
  },
  accountNo: {
    type: Number,
    unique: true,
    required: true,
  },
  ifscCode: {
    type: String,
    required: true,
    validate: {
      validator: function (value) {
        return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
      },
      message:
        "IFSC code must be 11 characters long and follow the specified format.",
    },
  },
  description: {
    type: String,
    required: true,
  },
});

// Create a mongoose model for the entry
const Account = mongoose.model("Account", accountSchema);

// Create Express application
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static("./public"));

app.post("/save", (req, res) => {
  const csvContent = req.body.csvContent;
  const entries = req.body.entries;
  // console.log(entries);

  // Extract account numbers from the new entries
  const newAccountNumbers = entries.map((entry) => entry.accountNo);

  // Find existing entries in the database
  Account.find({ accountNo: { $in: newAccountNumbers } })
    .then((existingEntries) => {
      // Filter out the existing account numbers
      const existingAccountNumbers = existingEntries.map(
        (entry) => entry.accountNo
      );
      const newEntries = entries.filter(
        (entry) => !existingAccountNumbers.includes(entry.accountNo)
      );

      // Prepare the remaining entries for bulk update
      const bulkUpdate = newEntries.map((entry) => ({
        updateOne: {
          filter: { accountNo: entry.accountNo },
          update: { $set: entry },
          upsert: true,
        },
      }));

      // Update the remaining entries in the database
      if (bulkUpdate.length > 0) {
        return Account.bulkWrite(bulkUpdate);
      } else {
        return Promise.resolve(); // No new entries to update
      }
    })
    .then(() => {
      console.log("New entries saved to the database");
    })
    .catch((error) => {
      console.error("Failed to save entries to the database", error);
      res.sendStatus(500);
    });
});

// Define a route to fetch account details
app.get("/accounts/:accountNumber", (req, res) => {
  const accountNo = req.params.accountNumber;
  // console.log(accountNumber);
  Account.findOne({ accountNo })
    .then((account) => {
      if (account) {
        res.json(account);
        // console.log(account);
      } else {
        res.status(404).json({ message: "Account not found." });
        // console.log("not found");
      }
    })
    .catch((err) => {
      res.status(500).json({ message: "Error fetching account details." });
      // console.log(err);
    });
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
