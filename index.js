require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Jimp = require("jimp");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let pledge = "";
let chatId = "";
let awaitingPledge = true;
let awaitingSelfie = false;
let isFirstLaunch = true;

bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id;
  if (isFirstLaunch) {
    bot.sendMessage(
      chatId,
      "Welcome to the AirQo #AQAWK24 Pledge Bot! Here's what you can do with this bot:\n\n" +
        "1. Send a pledge by typing it as a message.\n" +
        "2. Send a selfie to accompany your pledge.\n\n" +
        "Example:\n" +
        "To send a pledge: 'I pledge to protect the environment.'\n" +
        "To send a selfie: Simply upload a selfie photo.\n\n" +
        "Let's get started!\n\n" +
        "Please enter your pledge."
    );
    isFirstLaunch = false;
  } else {
    bot.sendMessage(chatId, "Please enter your pledge.");
  }
  awaitingPledge = true;
  awaitingSelfie = false;
});

bot.on("message", async (msg) => {
  if (!chatId) {
    return;
  }
  if (awaitingPledge && msg.text && !msg.photo) {
    pledge = msg.text;
    bot.sendMessage(chatId, "Please send your selfie.");
    awaitingPledge = false;
    awaitingSelfie = true;
  } else if (awaitingSelfie && msg.photo) {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    bot.getFileLink(photoId).then(async (link) => {
      try {
        const selfie = await Jimp.read(link);
        const container = await Jimp.read("assets/background.jpg");
        // masks should have a bg of white
        const mask2 = await Jimp.read("assets/mask2.png");
        let pledgeFont;
        let paddingY;
        if (pledge.length > 25) {
          pledgeFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
          paddingY = 50;
        } else {
          pledgeFont = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
          paddingY = 0;
        }

        container.cover(1080, 1350);

        // Calculate the dimensions and position of the pledge text within the pledgeBox
        const pledgeBoxWidth = 1080 - 110;
        const maxTextWidth = 0.8 * pledgeBoxWidth;
        const pledgeTextHeight = Jimp.measureTextHeight(
          pledgeFont,
          pledge,
          maxTextWidth
        );

        // Create pledge box with padding around the pledge text
        const pledgeBoxHeight = 156;
        const pledgeBox = new Jimp(
          pledgeBoxWidth,
          pledgeBoxHeight,
          "transparent"
        );
        const textPositionX = (pledgeBoxWidth - maxTextWidth) / 2; // Calculate the x position for centering the text
        const textPositionY = (pledgeBoxHeight - pledgeTextHeight) / 2; // Calculate the y position for centering the text vertically
        pledgeBox.print(
          pledgeFont,
          textPositionX,
          textPositionY, // Center the text vertically
          {
            text: pledge,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE, // Align text vertically to the middle
          },
          maxTextWidth,
          pledgeTextHeight
        );

        // Resize and position the selfie to occupy the remaining height of the container

        selfie.cover(955, 891);
        // Apply rounded corners to the selfie
        mask2.resize(selfie.bitmap.width, selfie.bitmap.height);
        selfie.mask(mask2, 0, 0);

        container.composite(pledgeBox, 45, 50).composite(selfie, 62, 255);

        // Resize and compress the final image
        container.resize(1080, 1350);
        // container.quality(60); // Adjust the quality as needed

        // Send the image back to the user
        const photoURL = await container.getBufferAsync(Jimp.MIME_JPEG);

        bot.sendPhoto(chatId, photoURL).catch((error) => {
          console.error("Error sending photo:", error);
          bot.sendMessage(chatId, "An error occurred while sending the photo.");
        });
        awaitingPledge = false;
        awaitingSelfie = false;
        pledge = "";
      } catch (err) {
        console.error("BUFFER ERROR:", err);
        bot.sendMessage(
          chatId,
          "An error occurred while processing the image."
        );
      }
    });
    awaitingPledge = false;
    awaitingSelfie = false;
  } else if (awaitingPledge) {
    bot.sendMessage(chatId, "Please enter a valid text pledge.");
  } else if (awaitingSelfie) {
    bot.sendMessage(chatId, "Please send a valid selfie image.");
  }
});
