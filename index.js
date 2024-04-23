require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Jimp = require("jimp");
const express = require("express");
const bodyParser = require("body-parser");

const port = 8080;

const token = process.env.BOT_TOKEN;
const appUrl = process.env.APP_URL;
const bot = new TelegramBot(token, { polling: true });

const app = express();
app.use(bodyParser.json());

// Define a handler for the webhook
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

const userContext = new Map();

const capitalise = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

bot.setWebHook(`${appUrl}/bot${token}`);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!userContext.has(chatId)) {
    userContext.set(chatId, {
      awaitingLocation: true,
      awaitingPledge: false,
      awaitingSelfie: false,
      isFirstLaunch: true,
      pledge: "",
      location: "",
      backgroundImage: "",
    });
  }
  const context = userContext.get(chatId);
  if (context.isFirstLaunch) {
    bot.sendMessage(
      chatId,
      "Welcome to the AirQo #AQAW24 Pledge Bot! Here's what you can do:\n\n1. Select your location from the options provided.\n2. Make a pledge to improve air quality in your area.\n3. Upload a selfie or choose a photo from your gallery.\n4. Download a cool poster to share on your socials.\n\nLet's get started! Select your location:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Uganda", callback_data: "uganda" },
              {
                text: "Nigeria",
                callback_data: "nigeria",
              },
            ],
            [
              { text: "Burundi", callback_data: "burundi" },
              { text: "Ghana", callback_data: "ghana" },
            ],
            [
              { text: "Kenya", callback_data: "kenya" },
              { text: "Cameroon", callback_data: "cameroon" },
            ],
          ],
        },
      }
    );
    context.isFirstLaunch = false;
  } else {
    bot.sendMessage(
      chatId,
      "Please select your location from the options provided:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Uganda", callback_data: "uganda" },
              {
                text: "Nigeria",
                callback_data: "nigeria",
              },
            ],
            [
              { text: "Burundi", callback_data: "burundi" },
              { text: "Ghana", callback_data: "ghana" },
            ],
            [
              { text: "Kenya", callback_data: "kenya" },
              { text: "Cameroon", callback_data: "cameroon" },
            ],
          ],
        },
      }
    );
  }
  userContext.set(chatId, context);
});

// Handle location selection
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const selectedLocation = query.data.toLowerCase(); // Retrieve the selected location from the callback data and convert to lowercase
  const locationBackgrounds = {
    uganda: "uganda_background.jpg",
    nigeria: "nigeria_background.jpg",
    burundi: "burundi_background.jpg",
    ghana: "ghana_background.jpg",
    kenya: "kenya_background.jpg",
    cameroon: "cameroon_background.jpg",
  };
  const backgroundImage = locationBackgrounds[selectedLocation];

  if (backgroundImage) {
    const context = userContext.get(chatId);
    // Update the context with the selected location and background image
    context.location = selectedLocation;
    context.backgroundImage = backgroundImage;

    // Remove the inline keyboard after the user has made a selection
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: query.message.message_id }
    );

    // Proceed to the next step (asking for the pledge)
    bot.sendMessage(
      chatId,
      `${capitalise(context.location)}, great! Please enter your pledge.`
    );
    context.awaitingLocation = false;
    context.awaitingPledge = true;
    userContext.set(chatId, context);
  } else {
    // Handle invalid location selection
    bot.sendMessage(
      chatId,
      "Please select a valid location from the options provided."
    );
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!userContext.has(chatId)) {
    return;
  }
  const context = userContext.get(chatId);
  if (context.awaitingPledge && msg.text && !msg.photo) {
    context.pledge = msg.text.replace(/[\uD800-\uDFFF]./g, "");
    bot.sendMessage(
      chatId,
      "Please send your selfie or choose your favorite photo from your gallery."
    );
    context.awaitingPledge = false;
    context.awaitingSelfie = true;
    userContext.set(chatId, context);
    console.log("Context:", context);
  } else if (context.awaitingSelfie && msg.photo) {
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    try {
      bot.sendMessage(
        chatId,
        "Thank you for the photo👍! Please be patient while I create your sticker..."
      );
      const link = await bot.getFileLink(photoId);
      try {
        const selfie = await Jimp.read(link);
        const container = await Jimp.read(`assets/${context.backgroundImage}`);
        // masks should have a bg of white
        const mask2 = await Jimp.read("assets/mask2.png");
        let pledgeFont;
        let paddingY;
        if (context.pledge.length > 25) {
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
          context.pledge,
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
            text: context.pledge,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE, // Align text vertically to the middle
          },
          maxTextWidth,
          pledgeTextHeight
        );

        // Resize and position the selfie to occupy the remaining height of the container

        console.log("RESIZING IMAGE CONTAINER...");

        selfie.cover(955, 891);
        // Apply rounded corners to the selfie
        mask2.resize(selfie.bitmap.width, selfie.bitmap.height);
        selfie.mask(mask2, 0, 0);

        container.composite(pledgeBox, 45, 50).composite(selfie, 62, 255);

        // Resize and compress the final image
        container.resize(1080, 1350);
        // container.quality(60); // Adjust the quality as needed

        console.log("BUFFERING...");

        // Send the image back to the user
        const photoURL = await container.getBufferAsync(Jimp.MIME_JPEG);

        try {
          await bot.sendPhoto(chatId, photoURL);
        } catch (error) {
          console.error("Error sending photo:", error);
          bot.sendMessage(chatId, "An error occurred while sending the photo.");
        } finally {
          // set chatId to empty
          userContext.delete(chatId);
        }
      } catch (err) {
        console.error("BUFFER ERROR:", err);
        bot.sendMessage(
          chatId,
          "An error occurred while processing the image."
        );
      }
    } catch (error) {
      bot.sendMessage(chatId, "An error occurred while processing the image.");
    } finally {
      userContext.delete(chatId);
      bot.sendMessage(chatId, "Type `/start` to create a new poster!");
    }
  } else if (context.awaitingPledge) {
    bot.sendMessage(chatId, "Please enter a valid text pledge.");
  } else if (context.awaitingSelfie) {
    bot.sendMessage(chatId, "Please send a valid selfie image.");
  }
});
