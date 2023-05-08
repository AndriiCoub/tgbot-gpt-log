import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import config from "config";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";

console.log(config.get("TEST_ENV"));

const INITIAL_SESSISON = {
  messages: [],
};
const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

bot.use(session());
bot.command("new", async (ctx) => {
  ctx.session = INITIAL_SESSISON;
  await ctx.reply("waiting for your voice or text message");
});

bot.command("start", async (ctx) => {
  ctx.session = INITIAL_SESSISON;
  await ctx.reply("waiting for your voice or text message");
});

bot.on(message("voice"), async (ctx) => {
  ctx.session ??= INITIAL_SESSISON;
  try {
    await ctx.reply(code("Hi message accepted for processing ...:)"));
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id); //получаєм силку на потрібний файл voice
    const userId = String(ctx.message.from.id); // буде відповідати id людини з якою йде взаємодія
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await openai.transcription(mp3Path);
    await ctx.reply(code(`Your request: ${text}`));

    ctx.session.messages.push({ role: openai.roles.USER, content: text });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await ctx.reply(response.content);
  } catch (e) {
    console.log(`error while voice message`, e.message);
  }
});

bot.on(message("text"), async (ctx) => {
  ctx.session ??= INITIAL_SESSISON;
  try {
    await ctx.reply(code("Hi message accepted for processing ...:)"));

    ctx.session.messages.push({
      role: openai.roles.USER,
      content: ctx.message.text,
    });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await ctx.reply(response.content);
  } catch (e) {
    console.log(`error while voice message`, e.message);
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
