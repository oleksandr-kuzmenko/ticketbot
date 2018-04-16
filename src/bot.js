const { cmd } = require("./telegramAPI");
const WatchDialog = require("./dialogs/watchDialog");
const { addTask, getTasks, setTasks } = require("./task");
const { ticketLink } = require("./govAPI");

async function hello(message) {
  const chatId = message.chat.id;
  await cmd("sendMessage", {
    chat_id: chatId,
    text: "Дратути"
  });
}

const dialogs = {};

async function watch(message) {
  const chatId = message.chat.id;
  dialogs[chatId] = new WatchDialog(chatId, (err, args) => {
    if (err) {
      delete dialogs[chatId];
      return;
    }
    addTask({
      from: args.from,
      to: args.to,
      date: args.date,
      chatId: args.chatId,
      options: args.options
    });
    console.log("Task added", args);
    delete dialogs[chatId];
  });
}

async function handleDialog(message, data) {
  const chatId = message.chat.id;
  const dialog = dialogs[chatId];
  if (!dialog || (dialog && dialog.done)) return;
  console.log(dialog.stage);
  await dialog[`stage${dialog.stage}`](message, data);
}

async function taskList(message) {
  const chatId = message.chat.id;
  const tasks = await getTasks();
  const chatTasks = tasks.filter(task => task.chatId === chatId);
  if (chatTasks.length) {
    await cmd("sendMessage", {
      chat_id: chatId,
      text: `Ищем такие поезда:\n${chatTasks
        .map(task => task.options.trains.join(", "))
        .join("|")}`
    });
  } else {
    await cmd("sendMessage", {
      chat_id: chatId,
      text: "Зейчаз ничего не ищем"
    });
  }
}

async function clearTaskList(message) {
  const chatId = message.chat.id;
  const tasks = await getTasks();
  const chatTasks = tasks.filter(task => task.chatId === chatId);
  const otherChatTasks = tasks.filter(task => task.chatId !== chatId);

  await setTasks(otherChatTasks);

  await cmd("sendMessage", {
    chat_id: chatId,
    text: `Отменил поиск поездов:\n${chatTasks
      .map(task => task.options.trains.join(", "))
      .join("|")}`
  });
}

async function sendTicketMessage(task, trainData) {
  await cmd("sendMessage", {
    chat_id: task.chatId,
    parse_mode: "HTML",
    text: `
<b>Ездь мезда!!!</b>
<b>${trainData.num} ${trainData.from.station} - ${trainData.to.station} ${
      task.date
    }</b>
<b>${trainData.types.map(t => `${t.title} - ${t.places}`).join(", ")}</b>
<a href="${ticketLink(task)}">КУБИДЬ БИЛЕД!</a>
    `
  });
}

const hasTrainMsgs = {};
async function hasTrain(task, trainData) {
  console.log(`Has tickets ${task.id}`);
  const chatId = task.chatId;
  if (!hasTrainMsgs[chatId]) {
    hasTrainMsgs[chatId] = {};
  }
  if (!hasTrainMsgs[chatId][task.id]) {
    hasTrainMsgs[chatId][task.id] = {
      times: 1,
      hasTickets: true
    };
    sendTicketMessage(task, trainData);
  } else {
    const ticketMsg = hasTrainMsgs[chatId][task.id];
    if (!ticketMsg.hasTickets) {
      sendTicketMessage(task, trainData);
    }
    ticketMsg.times = ticketMsg.times + 1;
    ticketMsg.hasTickets = true;
  }
}

async function hasNoTrain(task) {
  console.log(`Had no tickets ${task.id}`);
  const chatId = task.chatId;
  if (!hasTrainMsgs[chatId]) {
    hasTrainMsgs[chatId] = {};
  }
  if (!hasTrainMsgs[chatId][task.id]) {
    hasTrainMsgs[chatId][task.id] = {
      times: 1,
      hasTickets: false
    };
  } else {
    const ticketMsg = hasTrainMsgs[chatId][task.id];
    if (ticketMsg.hasTickets) {
      await cmd("sendMessage", {
        chat_id: chatId,
        text: `Уже мезд на ${task.trains.join(", ")} нет`
      });
    }
    ticketMsg.times = ticketMsg.times + 1;
    ticketMsg.hasTickets = false;
  }
}

module.exports = {
  hello,
  watch,
  handleDialog,
  taskList,
  clearTaskList,
  hasTrain,
  hasNoTrain
};