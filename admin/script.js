// * FIREBASE * //

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { db, auth } from "./firebase.js";

import {
  collection, // table
  addDoc, // insert
  getDocs, // all docs
  doc, // specific doc
  updateDoc, // update
  arrayUnion,
  deleteDoc, // delete
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const emailInput = document.querySelector("#email-input");
const passwordInput = document.querySelector("#password-input");

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLogIn();
  }
});

const loginBtn = document.querySelector("#login-btn");
const errorMsg = document.querySelector("#error-msg");

// log in
function handleLogIn() {
  const email = emailInput.value;
  const password = passwordInput.value;

  errorMsg.innerText = "Loggin in...";
  signInWithEmailAndPassword(auth, email, password).catch((error) => {
    errorMsg.innerText = "Error: " + error.message;
  });
}

loginBtn.addEventListener("click", handleLogIn);

/////

const data = {
  teams: [
    {
      players: [{ name: "alpha", inGameId: "XXXXXXX" }],
      games: [
        {
          placeTaken: 1,
          killsMade: 0,
          penaltyPoints: 0,
          playersSurvived: 0,
        },
      ],
      bucksBank: 0,
    },
  ],
};

const adminPanel = document.querySelector("#admin-panel");
const PANELS = {
  loginPanel: document.querySelector("#login-panel"),
  adminPanel: document.querySelector("#admin-panel"),
  teamsPanel: document.querySelector("#teams-panel"),
  battlesPanel: document.querySelector("#battles-panel"),

  addPlayerToTeam: document.querySelector("#new-player-form-container"),
  createBattle: document.querySelector("#new-battle-form-container"),
};

document.querySelectorAll(".back-to-admin-btn").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.add("hidden"));

    PANELS.adminPanel.classList.remove("hidden");
  }),
);

// login state change
onAuthStateChanged(auth, (user) => {
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));

  if (user) {
    const userName = user.email.split("@")[0].toUpperCase();
    console.log("Logged user: ", { userName });

    errorMsg.innerText = "";

    PANELS.adminPanel.innerHTML = /*html*/ `
      <p>Logged user: <strong>${userName}</strong></p>
      <button id="logout-btn" class="action-button">Log out</button> <hr />
      <button id="mng-teams-btn" class="action-button">Manage teams</button>
      <button id="mng-battles-btn" class="action-button">Manage battles</button>
    `;
    document.querySelector("#logout-btn").addEventListener("click", () => {
      signOut(auth);
    });
    document
      .querySelector("#mng-teams-btn")
      .addEventListener("click", showTeams);
    document
      .querySelector("#mng-battles-btn")
      .addEventListener("click", showBattles);

    PANELS.adminPanel.classList.remove("hidden");
  } else {
    PANELS.loginPanel.classList.remove("hidden");
  }
});

async function createTeam() {
  try {
    // SQL: SELECT TABLE teams
    const teamsRef = collection(db, "teams");

    const newTeamData = {
      players: [],
      bucksBank: 0,
      createdAt: new Date(),
    };

    // SQL: INSERT INTO teams() VALUES ()
    const docRef = await addDoc(teamsRef, newTeamData);
    await showTeams();
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

async function deleteTeam(teamId) {
  // SQL: SELECT
  const docRef = doc(db, "teams", teamId);

  try {
    deleteDoc(docRef);

    await showTeams();
  } catch (error) {
    console.error("Couldn't delete data from database: ", error);
  }
}

document.querySelector("#add-team-btn").addEventListener("click", createTeam);

async function showTeams() {
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
  PANELS.teamsPanel.classList.remove("hidden");

  try {
    // SQL: SELECT TABLE teams
    const teamsRef = collection(db, "teams");

    // SQL: SELECT * FROM teams
    const querySnapshot = await getDocs(teamsRef);

    const teamsListDiv = document.querySelector("#teams-list");
    teamsListDiv.innerHTML = ``;

    querySnapshot.forEach((doc) => {
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-div";
      teamDiv.innerHTML = /*html*/ `
        <button title="Delete team" class="delete-team-btn small-action-button" data-teamid="${doc.id}" style="background-color:#500;">- team</button>
      `;
      teamDiv
        .querySelector(".delete-team-btn")
        .addEventListener("click", function () {
          const answer = confirm("Are you sure?");
          if (answer) deleteTeam(this.dataset.teamid);
        });

      const teamData = doc.data();

      const playersBox = document.createElement("p");
      playersBox.className = "players-box";
      playersBox.innerHTML = /*html*/ `
        <button title="Add player to team" class="add-player-btn small-action-button" data-teamid="${doc.id}" style="background-color: #050;">+ player</button>`;
      playersBox
        .querySelector(".add-player-btn")
        .addEventListener("click", function () {
          addPlayerToTeam(this.dataset.teamid);
        });

      teamData?.players.forEach((player) => {
        playersBox.insertAdjacentHTML(
          "beforeend",
          /*html*/ `
          <span title="${player.inGameId || "no in-game id"}">${player.name || "player"}</span>
        `,
        );
      });

      teamDiv.appendChild(playersBox);
      teamsListDiv.appendChild(teamDiv);
    });
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

async function showBattles() {
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
  PANELS.battlesPanel.classList.remove("hidden");

  let teams = [];

  try {
    // 1. get teams

    const teamsRef = collection(db, "teams");

    const querySnapshotTeams = await getDocs(teamsRef);

    querySnapshotTeams.forEach((doc) => {
      const teamData = doc.data();
      teams.push({ teamId: doc.id, teamData });
    });

    // 2. get battles

    const battlesRef = collection(db, "battles");

    const querySnapshotBattles = await getDocs(battlesRef);

    const battlesListDiv = PANELS.battlesPanel.querySelector("#battles-list");
    battlesListDiv.innerHTML = ``;

    querySnapshotBattles.forEach((doc) => {
      const battleDiv = document.createElement("div");
      battleDiv.className = "battle-div";

      const battleData = doc.data();

      battleDiv.innerHTML = /*html*/ `
        ${getPlayersString(teams.find((t) => t.teamId === battleData.team1).teamData.players) || "error"}
          &nbsp;vs&nbsp; 
        ${getPlayersString(teams.find((t) => t.teamId === battleData.team2).teamData.players) || "error"}
      `;

      battlesListDiv.appendChild(battleDiv);
    });
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

function getPlayersString(playersArray) {
  let string = `<p class="players-box">`;
  playersArray.forEach((p) => {
    string += `<span title="${p.inGameId || "no in-game id"}">${p.name || "player"}</span>`;
  });
  string += `</p>`;

  return string;
}

document
  .querySelector("#add-battle-btn")
  .addEventListener("click", openAddBattlePanel);
document.querySelector("#cancel-battle-btn").addEventListener("click", () => {
  PANELS.createBattle.classList.add("hidden");
});

let selectedTeams = [];

const beginBattleButton = document.querySelector("#begin-battle-btn");
beginBattleButton.addEventListener("click", () => {
  if (selectedTeams.length !== 2) return;

  createBattle(selectedTeams[0], selectedTeams[1]);
  PANELS.createBattle.classList.add("hidden");
  showBattles();
});

async function openAddBattlePanel() {
  PANELS.createBattle.classList.remove("hidden");

  const teamSelectGrid = document.querySelector("#team-select-grid");
  teamSelectGrid.innerHTML = ``;

  beginBattleButton.disabled = true;

  const teamsRef = collection(db, "teams");
  try {
    const querySnapshot = await getDocs(teamsRef);

    querySnapshot.forEach((doc) => {
      const teamData = doc.data();

      const teamDiv = document.createElement("div");
      teamDiv.innerHTML = /*html*/ `
          <input type="checkbox" class="select-team-checkbox small-action-button" data-teamid="${doc.id}" />
          <p class="players-box"></p>
        `;

      teamDiv
        .querySelector(".select-team-checkbox")
        .addEventListener("change", function (e) {
          if (e.target.checked) {
            if (selectedTeams.find((teamId) => teamId === this.dataset.teamid))
              return;
            selectedTeams.push(this.dataset.teamid);
          } else {
            selectedTeams = selectedTeams.filter(
              (teamId) => teamId !== this.dataset.teamid,
            );
          }

          beginBattleButton.disabled = selectedTeams.length !== 2;
        });

      const playersBox = teamDiv.querySelector(".players-box");

      teamData?.players.forEach((player) => {
        playersBox.insertAdjacentHTML(
          "beforeend",
          /*html*/ `
              <span title="${player.inGameId || "no in-game id"}">${player.name || "player"}</span>
            `,
        );
      });

      teamSelectGrid.appendChild(teamDiv);
    });
  } catch (error) {
    console.error("Couldn't get teams: ", error);
  }
}

async function createBattle(team1Id, team2Id) {
  try {
    const battlesRef = collection(db, "battles");

    const newBattleData = {
      team1: team1Id,
      team2: team2Id,
      createdAt: new Date(),
    };

    const docRef = await addDoc(battlesRef, newBattleData);
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

async function addPlayerToTeam(teamId) {
  PANELS.addPlayerToTeam.classList.remove("hidden");

  document.querySelector("#new-player-name").value = "";
  document.querySelector("#new-player-id").value = "";
  document.querySelector("#team-id").value = teamId;
}

const addPlayerToTeamForm = document.querySelector("#new-player-form");
addPlayerToTeamForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const playerName = addPlayerToTeamForm["new-player-name"].value.trim();
  if (playerName === "") {
    alert("Please insert player name");
    return;
  }

  const playerId = addPlayerToTeamForm["new-player-id"].value.trim();

  const teamId = addPlayerToTeamForm["team-id"].value;

  // get one doc (record)
  const teamDocRef = doc(db, "teams", teamId);

  const newPlayer = {
    name: playerName,
    inGameId: playerId === "" ? null : playerId,
  };

  try {
    await updateDoc(teamDocRef, {
      // add element to array
      players: arrayUnion(newPlayer),
    });

    await showTeams();
  } catch (error) {
    console.error("Couldn't add player to team: ", error);
  }
});
