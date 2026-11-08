// icon = small round version (lists), img = full card, color = accent when the role is shown
// Edit role text, teams and night order here. Card art lives in public/cards/<key>.png
// If you add a role, also add its key to ROLE_KEYS in server.js.
const ROLES = {
  villager: { name: "Villager", team: "Village", img: "cards/villager.png", icon: "icons/villager.png", color: "#e0b070",
    what: "You have no special power. Your voice and your vote are your weapons.",
    night: "Sleep. Keep your eyes closed.",
    tip: "Say honestly what you think. Wolves will pretend to be you, so watch who dodges questions." },
  werewolf: { name: "Werewolf", team: "Wolves", img: "cards/werewolf.png", icon: "icons/werewolf.png", color: "#d4443a",
    what: "You are secretly a wolf. Wolves win when they equal or outnumber the village.",
    night: "Wake with the other wolves and silently point at one player to eat.",
    tip: "Blend in. Sometimes accuse a fellow wolf to look innocent. Never reveal yourself." },
  seer: { name: "Seer", team: "Village", img: "cards/seer.png", icon: "icons/seer.png", color: "#b97ee3",
    what: "You can sense wolves. Help the village find them without getting eaten first.",
    night: "Point at one player. The narrator answers with a thumbs-up (Village) or thumbs-down (Wolf).",
    tip: "Revealing yourself helps the village trust you, but paints a target on your back." },
  defender: { name: "Defender", team: "Village", img: "cards/defender.png", icon: "icons/defender.png", color: "#5b9ee3",
    what: "You can shield one person from the wolves each night.",
    night: "Point at one player to protect. You may protect yourself, but not the same person two nights in a row.",
    tip: "Guess who the wolves want most. It is often the Seer." },
  witch: { name: "Witch", team: "Village", img: "cards/witch.png", icon: "icons/witch.png", color: "#e0924a",
    what: "You hold one healing potion and one poison for the whole game.",
    night: "The narrator shows you tonight’s victim. You may save them, poison anyone, both, or neither. Each potion works once.",
    tip: "Don’t waste your poison. A well-timed save can reveal a lot." },
  hunter: { name: "Hunter", team: "Village", img: "cards/hunter.png", icon: "icons/hunter.png", color: "#5fbf62",
    what: "If you die, for any reason, you take someone down with you.",
    night: "No night action. Sleep.",
    tip: "When you die, immediately shoot one player of your choice. They die too." },
};
const NIGHT_ORDER = ["werewolf", "defender", "seer", "witch"]; // narrator wakes these in turn
const BACK = "cards/back.png";
