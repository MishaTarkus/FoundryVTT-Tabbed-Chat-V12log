// Tabbed Chatlog V12-Compatible Main Script
let currentTab = "ic";
let salonEnabled = false;
let turndown = undefined;

function isMessageTypeVisible(messageType) {
  if (salonEnabled) {
    if (messageType === CONST.CHAT_MESSAGE_TYPES.OTHER) messageType = CONST.CHAT_MESSAGE_TYPES.IC;
    if (messageType === CONST.CHAT_MESSAGE_TYPES.WHISPER) return false;
  }
  switch (currentTab) {
    case "rolls":
      return [CONST.CHAT_MESSAGE_TYPES.OTHER, CONST.CHAT_MESSAGE_TYPES.ROLL].includes(messageType);
    case "ic":
      if ([CONST.CHAT_MESSAGE_TYPES.IC, CONST.CHAT_MESSAGE_TYPES.EMOTE].includes(messageType)) return true;
      if (messageType === CONST.CHAT_MESSAGE_TYPES.WHISPER) return game.settings.get("tabbed-chatlog", "icWhispers");
      return false;
    case "ooc":
      if (messageType === CONST.CHAT_MESSAGE_TYPES.OOC) return true;
      if (messageType === CONST.CHAT_MESSAGE_TYPES.WHISPER) return !game.settings.get("tabbed-chatlog", "icWhispers");
      return false;
  }
  return true;
}

function isMessageVisible(message) {
  if (!isMessageTypeVisible(message.type)) return false;
  if (message.speaker.scene && game.settings.get("tabbed-chatlog", "perScene")) {
    if ([CONST.CHAT_MESSAGE_TYPES.IC, CONST.CHAT_MESSAGE_TYPES.EMOTE].includes(message.type) && message.speaker.scene !== game.scenes.viewed?.id) return false;
  }
  if (message.blind && !message.whisper.includes(game.userId)) return false;
  return true;
}

function setClassVisibility(cssClass, visible) {
  visible ? cssClass.removeClass("hardHide").show() : cssClass.hide();
}

Hooks.on("renderChatLog", async (chatLog, html) => {
  if (shouldHideDueToStreamView()) return;

  html.prepend(`<nav class="tabbedchatlog tabs">
    <a class="item ic" data-tab="ic">${game.i18n.localize("TC.TABS.IC")}</a><i id="icNotification" class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
    <a class="item rolls" data-tab="rolls">${game.i18n.localize("TC.TABS.Rolls")}</a><i id="rollsNotification" class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
    <a class="item ooc" data-tab="ooc">${game.i18n.localize("TC.TABS.OOC")}</a><i id="oocNotification" class="notification-pip fas fa-exclamation-circle" style="display: none;"></i>
  </nav>`);

  window.game.tabbedchat = {};
  window.game.tabbedchat.tabs = new TabsV2({
    navSelector: ".tabbedchatlog.tabs",
    contentSelector: ".content",
    initial: "ic",
    callback: (event, html, tab) => {
      currentTab = tab;
      [0, 1, 2, 3, 4, 5].forEach(type => {
        setClassVisibility($(`.type${type}`), isMessageTypeVisible(type));
      });
      ["icNotification", "rollsNotification", "oocNotification"].forEach(id => $(`#${id}`).hide());
      $("#chat-log").scrollTop(9999999);
    }
  });
  window.game.tabbedchat.tabs.bind(html[0]);
});

Hooks.on("renderChatMessage", (chatMessage, html) => {
  if (shouldHideDueToStreamView()) return;

  html.addClass(`type${chatMessage.type}`);
  let sceneMatches = true;

  if ([CONST.CHAT_MESSAGE_TYPES.OTHER, CONST.CHAT_MESSAGE_TYPES.IC, CONST.CHAT_MESSAGE_TYPES.EMOTE, CONST.CHAT_MESSAGE_TYPES.ROLL].includes(chatMessage.type)) {
    if (chatMessage.speaker.scene && game.settings.get("tabbed-chatlog", "perScene")) {
      html.addClass("scenespecific scene" + chatMessage.speaker.scene);
      if (chatMessage.speaker.scene !== game.scenes.viewed?.id) sceneMatches = false;
    }
  }

  const show = isMessageVisible(chatMessage);
  show ? html.show() : html.hide().addClass("hardHide");
});

Hooks.on("createChatMessage", (chatMessage) => {
  const sceneMatches = !chatMessage.speaker.scene || chatMessage.speaker.scene === game.scenes.viewed?.id;
  const autoSwitch = game.settings.get("tabbed-chatlog", "autoNavigate");

  if ([CONST.CHAT_MESSAGE_TYPES.OTHER, CONST.CHAT_MESSAGE_TYPES.ROLL].includes(chatMessage.type) && sceneMatches && chatMessage.whisper.length === 0) {
    if (currentTab !== "rolls") {
      autoSwitch ? window.game.tabbedchat.tabs.activate("rolls", { triggerCallback: true }) : $("#rollsNotification").show();
    }
  } else if ([CONST.CHAT_MESSAGE_TYPES.IC, CONST.CHAT_MESSAGE_TYPES.EMOTE].includes(chatMessage.type) || (chatMessage.type === CONST.CHAT_MESSAGE_TYPES.WHISPER && game.settings.get("tabbed-chatlog", "icWhispers"))) {
    if (currentTab !== "ic" && sceneMatches) {
      autoSwitch ? window.game.tabbedchat.tabs.activate("ic", { triggerCallback: true }) : $("#icNotification").show();
    }
  } else {
    if (chatMessage.type === CONST.CHAT_MESSAGE_TYPES.WHISPER && salonEnabled && !game.settings.get("tabbed-chatlog", "icWhispers")) return;
    if (currentTab !== "ooc") {
      autoSwitch ? window.game.tabbedchat.tabs.activate("ooc", { triggerCallback: true }) : $("#oocNotification").show();
    }
  }
});

Hooks.on("preCreateChatMessage", (chatMessage, data) => {
  if (game.settings.get("tabbed-chatlog", "icChatInOoc") && currentTab === "ooc" && data.type === CONST.CHAT_MESSAGE_TYPES.IC) {
    data.type = CONST.CHAT_MESSAGE_TYPES.OOC;
    delete data.speaker;
  }
});

function shouldHideDueToStreamView() {
  return game.settings.get("tabbed-chatlog", "hideInStreamView") && window.location.href.endsWith("/stream");
}

Hooks.on("init", () => {
  game.settings.register("tabbed-chatlog", "oocWebhook", {
    name: "OOC Webhook URL",
    hint: "Optional webhook for OOC chat.",
    scope: "world",
    config: true,
    default: "",
    type: String,
  });

  game.settings.register("tabbed-chatlog", "icBackupWebhook", {
    name: "IC Backup Webhook",
    hint: "Fallback webhook for IC messages.",
    scope: "world",
    config: true,
    default: "",
    type: String,
  });

  game.settings.register("tabbed-chatlog", "icChatInOoc", {
    name: "Post IC as OOC from OOC tab",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register("tabbed-chatlog", "hideInStreamView", {
    name: "Hide in Stream View",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register("tabbed-chatlog", "perScene", {
    name: "Per Scene Filtering",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register("tabbed-chatlog", "icWhispers", {
    name: "Include Whispers in IC",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register("tabbed-chatlog", "autoNavigate", {
    name: "Auto Switch Tabs",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
  });

  salonEnabled = game.modules.get("salon")?.active;
});


function sendToDiscord(webhook, body) {
  fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).catch(err => console.error("[Tabbed Chatlog] Discord webhook error:", err));
}

function loadActorForChatMessage(speaker) {
  let actor = null;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) {
    game.actors.forEach(a => { if (a.name === speaker.alias) actor = a });
  }
  return actor;
}

function generatePortraitImageElement(actor) {
  return actor.token?.texture?.src || actor.prototypeToken?.texture?.src || actor.img || "";
}

Hooks.on("renderSceneConfig", (app, html) => {
  if (app.document.compendium) return;

  let current = app.document.getFlag("tabbed-chatlog", "webhook") ?? "";
  const input = `
  <div class="form-group">
    <label>${game.i18n.localize("TC.SETTINGS.IcSceneWebhookName")}</label>
    <input id="scenewebhook" type="text" name="scenewebhook" value="${current}" placeholder="Webhook"/>
    <p class="notes">${game.i18n.localize("TC.SETTINGS.IcSceneWebhookHint")}</p>
  </div>`;

  const target = html.find("select[name='journal']").closest(".form-group");
  target.after(input);
});

Hooks.on("closeSceneConfig", (app, html) => {
  if (app.document.compendium) return;
  const value = html.find("input[name='scenewebhook']").val();
  app.document.setFlag("tabbed-chatlog", "webhook", value);
});

Hooks.on("sidebarCollapse", (_bar, collapsed) => {
  if (!collapsed) setALLTabsNotifyProperties();
});

Hooks.on("ready", () => {
  turndown = new TurndownService();
  const sidebar = document.querySelector('#sidebar');
  sidebar.addEventListener("mousedown", () => {
    sidebar.addEventListener("mousemove", sidebarMouseMove);
    sidebar.addEventListener("mouseup", () => {
      sidebar.removeEventListener("mousemove", sidebarMouseMove);
    });
  });

  function sidebarMouseMove() {
    setALLTabsNotifyProperties();
  }
});

function setICNotifyProperties() {
  const nTabs = $("nav.tabbedchatlog.tabs > a.item").length;
  $("#icNotification").css({ right: ($("#sidebar").width() / nTabs * (nTabs - 1)) + "px" });
}

function setRollsNotifyProperties() {
  const nTabs = $("nav.tabbedchatlog.tabs > a.item").length;
  $("#rollsNotification").css({ right: ($("#sidebar").width() / nTabs * (nTabs - 2)) + "px" });
}

function setOOCNotifyProperties() {
  const nTabs = $("nav.tabbedchatlog.tabs > a.item").length;
  $("#oocNotification").css({ right: ($("#sidebar").width() / nTabs * (nTabs - 3)) + "px" });
}

function setALLTabsNotifyProperties() {
  setICNotifyProperties();
  setRollsNotifyProperties();
  setOOCNotifyProperties();
}

Messages.prototype.flush = async function () {
  return Dialog.confirm({
    title: game.i18n.localize("CHAT.FlushTitle"),
    content: game.i18n.localize("CHAT.FlushWarning"),
    yes: () => ChatMessage.deleteDocuments(game.messages.filter(m => isMessageVisible(m)).map(m => m.id)),
    options: {
      top: window.innerHeight - 150,
      left: window.innerWidth - 720
    }
  });
};
