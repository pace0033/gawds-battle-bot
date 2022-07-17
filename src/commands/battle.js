const { SlashCommandBuilder } = require('@discordjs/builders');
const Gawd = require('../modules/Gawd');
const coinFlip = require('../modules/coinFlip');

// Returns a psuedorandom valid Gawd ID
function getRandomId() {
  return Math.floor(Math.random() * 5882 + 1);
}

// Check if user supplied a valid Gawd ID
function isValidId(id) {
  return id > 0 && id < 5883;
}

async function createThread(interaction, id) {
  const battleName = `${interaction.user.username}'s Battle - Gawd ${id}`;
  await interaction.editReply(`🧵 Creating new thread: ${battleName}`);
  return await interaction.channel.threads.create({
    name: battleName,
    autoArchiveDuration: 60,
    reason: 'Time to battle!',
  });
}

async function sendVersusMessages(thread, userGawd, cpuGawd) {
  await thread.send(`You selected *${userGawd.name}* as your fighter!`);
  await thread.send({ embeds: [userGawd.embed] });
  await thread.send('**VERSUS**');
  await thread.send({ embeds: [cpuGawd.embed] });
  await thread.send(
    `The computer selected *${cpuGawd.name}* as your opponent!`
  );
}

async function startCoinFlip(thread) {
  const userCalledSide = await coinFlip.getUserResponse(thread);
  await thread.send('Flipping coin...');
  const flipResult = coinFlip.flip();
  const userWon = userCalledSide === flipResult ? true : false;
  userWon
    ? await thread.send(`🎉 The coin landed on **${flipResult}**. You won!`)
    : await thread.send(`😔 The coin landed on **${flipResult}**. You lost.`);
  return userWon;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Start a battle of the Gawds!')
    .addIntegerOption((option) =>
      option
        .setName('id')
        .setDescription('The ID of the Gawd to battle')
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      // Immediately deferReply() so interaction token doesn't expire during battle
      await interaction.deferReply({ ephemeral: true });
      // Check if user supplied a valid Gawd ID
      const userGawdId = interaction.options.getInteger('id');
      if (!isValidId(userGawdId)) {
        // If ID is not valid, provide user feedback and exit battle
        throw new RangeError(
          'Invalid ID. Start a new battle with an ID between 1 and 5882.'
        );
      }
      // Generate a randomized opponent controlled by the CPU
      // if the random ID is the same as user's ID, generate a new ID
      let cpuGawdId;
      do {
        cpuGawdId = getRandomId();
      } while (cpuGawdId === userGawdId);

      // create user and CPU Gawd objects
      const userGawd = new Gawd(userGawdId);
      const cpuGawd = new Gawd(cpuGawdId, false);
      // Populate Gawd objects by calling Gawds.xyz API
      await userGawd.requestData();
      await cpuGawd.requestData();

      // create the battle thread
      const thread = await createThread(interaction, userGawdId);
      // add user to the battle thread
      await thread.members.add(interaction.user);

      // Send VERSUS intro messages to thread
      await sendVersusMessages(thread, userGawd, cpuGawd);

      // Flip a coin to determine who goes first
      const userWon = await startCoinFlip(thread);
      console.log(userWon);
    } catch (error) {
      await interaction.editReply(`⚠️ **${error.name}** - ${error.message}`);
      return;
    }
  },
};
