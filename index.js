var saveData = load(saveData);

app.get('/', (req, res) => {
  res.send("hello world!")
})

app.listen(3000, () => { console.log("YappingBot Ready!") });

function load() {
  try {
    var saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8'));
  } catch (e) {
      // init if no data found
      var saveData = {
          "Warnings": ["Send a message telling the users to move the conversation to the \"yapping\" channel"],
          "YappingRegister": {}
      }
  }
  return saveData;
}

function save(saveData){
  fs.writeFileSync('./save-data.json', JSON.stringify(saveData));
}

async function askAI(prompt){
  const response = await openai.chat.completions.create({
      messages: [{role: "system", content: "You are a warning system for a discord server that keeps users from talking too much (yapping) in the wrong channels and directs them to instead move the conversation to the right channel, the \"yapping\" channel. Keep all following responses to a very short, concise paragraph."}, 
      { role: "user", content: prompt + " (be sure to be passive aggressive, mildly insulting, witty, and snarky in your response)" }],
      model: "gpt-3.5-turbo",
    });
  return response.choices[0].message.content;
}

client.on('ready', () => { 
    console.log("YappingBot is up and running");
})

client.on('messageCreate', async msg => {

  // ignore self messages and other bot messages. Ignore Yapping messages.
  if (msg.author === client.user || msg.author.bot || ("" + msg.channel.id) != YAPPING_CHANNEL_ID) {
    return;
  }

  if (msg.content.toLowerCase().includes("!help-yapping")){
    msg.channel.send(
`
Hi! I'm YappingBot, and I let y'all know when you are yapping too much and \"gently encourage\" you to move to the yapping channel instead with a \"fun\" AI message.
(Current settings: Trigger on ${process.env.YAPPING_AMOUNT_TRIGGER} messages sent in a channel within ${process.env.YAPPING_MINUTES_TRIGGER} minutes)

You can use the command "!add-yap-warning-prompt" followed by your prompt to add an AI yapping warning prompt to the random prompt list.
`
    );
  }

  if (msg.content.toLowerCase().includes("!add-yap-warning-prompt")){
    var warning = msg.content.substring(23);
    if (warning.length < 1){
      msg.channel.send("Please provide a yapping prompt");
      return;
    }
    // Check if the warning length exceeds the maximum limit
    if (warning.length > Number(process.env.MAX_WARNING_LENGTH)) {
      msg.channel.send(`The warning is too long. Please limit it to ${process.env.MAX_WARNING_LENGTH} characters.`);
      return;
    }

    saveData = load(saveData);

    if (!Array.isArray(saveData["Warnings"])){
      saveData["Warnings"] = [];
    }
    saveData["Warnings"].push(warning);
    save();
  }

  else {
    const nowInMinutes = Math.ceil(Date.now() / (60 * 1000));
    const expiryTime = nowInMinutes + Number(process.env.YAPPING_MINUTES_TRIGGER);
    const channelId = msg.channel.id;

    // Ensure the channel exists in YappingRegister
    if (!saveData["YappingRegister"][channelId]) {
        saveData["YappingRegister"][channelId] = [];
    }

    // Add the expiry time
    saveData["YappingRegister"][channelId].push(expiryTime);

    // Remove expired yaps
    saveData["YappingRegister"][channelId] = saveData["YappingRegister"][channelId].filter(yapExpiry => yapExpiry > nowInMinutes);

    // Check if yapping limit is exceeded for the specific channel
    if (saveData["YappingRegister"][channelId].length >= process.env.YAPPING_AMOUNT_TRIGGER) {
        const randomWarningPrompt = saveData["Warnings"][Math.floor(Math.random() * saveData["Warnings"].length)];
        saveData["YappingRegister"][channelId] = [];
        await msg.channel.send(askAI(randomWarningPrompt));
    }
  }

});

client.login(process.env.TOKEN);