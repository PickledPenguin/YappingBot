// All helper functions for index.js
const express = require('express')
const app = express()
const fs = require('fs')
require("dotenv").config()

const { OpenAI } = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_TOKEN,
});

const discord = require('discord.js')
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageMentions
  ]
});

var saveData = load(saveData);

app.get('/', (req, res) => {
  res.send("hello world!")
})

app.listen(3001, () => { console.log("YappingBot Ready!") });

function load() {
  try {
    var saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8'));
  } catch (e) {
    // init if no data found
    var saveData = {
      "Warnings": ["Send a message telling the users to move the conversation to the \"yapping\" channel"],
      "YappingRegister": {},
      "BirthdayRegister": {}
    };
  }
  return saveData;
}

function save(saveData){
  fs.writeFileSync('./save-data.json', JSON.stringify(saveData));
}

async function askAIYap(prompt){
  const response = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a warning system for a discord server that keeps users from talking too much (yapping) in the wrong channels and directs them to instead move the conversation to the right channel, the \"yapping\" channel. Keep all following responses to a very short, concise paragraph." },
      { role: "user", content: prompt + " (be sure to be passive aggressive, mildly insulting, witty, and snarky in your response)" }
    ],
    model: "gpt-3.5-turbo",
  });
  return response.choices[0].message.content;
}

async function askAIBirthday(username){
  const response = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "You are a birthday congradulations AI for a discord server! Keep all following responses to a very short, concise paragraph." },
      { role: "user", content: "Say happy birthday to " + username + " with many well-wishes and a cheerful tone!" }
    ],
    model: "gpt-3.5-turbo",
  });
  return response.choices[0].message.content;
}

client.on('ready', () => {
  console.log("YappingBot is up and running");
});

client.on('messageCreate', async msg => {
  if (msg.author === client.user || msg.author.bot) {
    return;
  }

  // !help-yapping command
  if (msg.content.toLowerCase().includes("!help-yapping")) {
    msg.channel.send(
      `Hi! I'm YappingBot, and I let y'all know when you are yapping too much and \"gently encourage\" you to move to the yapping channel instead with a \"fun\" AI message.
      (Current settings: Trigger on ${process.env.YAPPING_AMOUNT_TRIGGER} messages sent in a channel within ${process.env.YAPPING_MINUTES_TRIGGER} minutes)

      You can use the command "!add-yap-warning-prompt" followed by your prompt to add an AI yapping warning prompt to the random prompt list.`
    );
  }

  // !add-yap-warning-prompt command
  if (msg.content.toLowerCase().includes("!add-yap-warning-prompt")) {
    var warning = msg.content.substring(23).trim();
    if (warning.length < 1) {
      msg.channel.send("Please provide a yapping prompt.");
      return;
    }

    if (warning.length > Number(process.env.MAX_WARNING_LENGTH)) {
      msg.channel.send(`The warning is too long. Please limit it to ${process.env.MAX_WARNING_LENGTH} characters.`);
      return;
    }

    saveData = load(saveData);

    if (!Array.isArray(saveData["Warnings"])) {
      saveData["Warnings"] = [];
    }

    const duplicateWarning = saveData["Warnings"].some(existingWarning => existingWarning.toLowerCase() === warning.toLowerCase());

    if (duplicateWarning) {
      msg.channel.send("This yap warning prompt already exists.");
    } else {
      saveData["Warnings"].push(warning);
      msg.channel.send("New yap warning prompt successfully added :thumbsup:");
    }

    save(saveData);
  }

  // Yapping logic
  else if (("" + msg.channel) != process.env.YAPPING_CHANNEL_ID) {
    const nowInMinutes = Math.ceil(Date.now() / (60 * 1000));
    const expiryTime = nowInMinutes + Number(process.env.YAPPING_MINUTES_TRIGGER);
    const channelId = msg.channel.id;

    if (!saveData["YappingRegister"][channelId]) {
      saveData["YappingRegister"][channelId] = [];
    }

    saveData["YappingRegister"][channelId].push(expiryTime);
    saveData["YappingRegister"][channelId] = saveData["YappingRegister"][channelId].filter(yapExpiry => yapExpiry > nowInMinutes);

    if (saveData["YappingRegister"][channelId].length >= process.env.YAPPING_AMOUNT_TRIGGER) {
      const randomWarningPrompt = saveData["Warnings"][Math.floor(Math.random() * saveData["Warnings"].length)];
      saveData["YappingRegister"][channelId] = [];
      askAIYap(randomWarningPrompt)
        .then(response => msg.channel.send(response));
    }
  }

  // Birthday recognition
  if (msg.mentions.users.size > 0 && /(happy\s*(b(?:ir)?thday|b-?day)|hbd|feliz cumpleaños|congratulations on your birthday|congradulations|congrats|grats)/i.test(msg.content)) {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    saveData = load(saveData);

    msg.mentions.users.forEach(user => {
      const userId = user.id;

      if (!saveData["BirthdayRegister"][userId]) {
        saveData["BirthdayRegister"][userId] = [];
      }

      saveData["BirthdayRegister"][userId].push(now);
      saveData["BirthdayRegister"][userId] = saveData["BirthdayRegister"][userId].filter(time => now - time <= dayInMs);

      if (saveData["BirthdayRegister"][userId].length > 3) {
        askAIBirthday(randomWarningPrompt)
        .then(response => msg.channel.send(response));
        
        msg.channel.send(`🎉 Happy Birthday to <@${userId}>! 🎉`);
        saveData["BirthdayRegister"][userId] = [];
      }
    });

    save(saveData);
  }

  save(saveData);
});

client.login(process.env.TOKEN);
