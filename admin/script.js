//#region imports

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
  doc, // specific doc (reference)
  getDoc, // specific doc (data)
  updateDoc, // update
  arrayUnion,
  deleteDoc, // delete
  query,
  where,
  count,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

//#endregion

//#region login

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

//#endregion

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

//#region panels handlers

const adminPanel = document.querySelector("#admin-panel");
const PANELS = {
  loginPanel: document.querySelector("#login-panel"),
  adminPanel: document.querySelector("#admin-panel"),
  teamsPanel: document.querySelector("#teams-panel"),
  battlesPanel: document.querySelector("#battles-panel"),
  tournamentPanel: document.querySelector("#tournament-panel"),
  battleGamePanel: document.querySelector("#battle-game-panel"),

  addPlayerToTeam: document.querySelector("#new-player-form-container"),
  createBattle: document.querySelector("#new-battle-form-container"),
};

addEventListener("DOMContentLoaded", (event) => {
  document.querySelectorAll(".back-to-tournament-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.add("hidden"));

      PANELS.tournamentPanel.classList.remove("hidden");
    }),
  );

  document.querySelectorAll(".back-to-admin-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.add("hidden"));

      PANELS.adminPanel.classList.remove("hidden");
    }),
  );
});

let loggedUser = null;

// login state change
onAuthStateChanged(auth, (user) => {
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));

  if (user) {
    loggedUser = user;

    const userName = user.email.split("@")[0].toUpperCase();
    console.log("Logged user: ", { userName });

    errorMsg.innerText = "";

    PANELS.adminPanel.innerHTML = /*html*/ `
      <div><p style="display: inline-block;">Logged user: <strong>${userName}</strong></p>
      <button id="logout-btn" class="action-button"><i class="bi bi-door-open"></i> Log out</button></div> <hr />
      <p>Your tournaments</p>
        <table id="tournaments-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creation date</th>
              <th>Battles amount</th>
              <th>Actions <button id="new-tournament-btn" class="small-action-button"><i class="bi bi-plus-circle"></i> new</button></th>
            </tr>
          </thead>
          <tbody>

          </tbody>
        </table>
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
    document
      .querySelector("#new-tournament-btn")
      .addEventListener("click", newTournament);

    showAllTournaments();

    PANELS.adminPanel.classList.remove("hidden");
  } else {
    PANELS.loginPanel.classList.remove("hidden");
    loggedUser = null;
  }
});

//#endregion

//#region tournaments

async function showAllTournaments() {
  try {
    const tournamentsRef = collection(db, "tournaments");
    const querySnapshot = await getDocs(tournamentsRef);

    const tournamentsTable = document.querySelector("#tournaments-table");
    if (!tournamentsTable) {
      console.error("Tournaments table not found");
      return;
    }
    const tableBody = tournamentsTable.querySelector("tbody");
    tableBody.innerHTML = "";

    // for...of can do await
    for (const doc of querySnapshot.docs) {
      const tournamentData = doc.data();

      const battlesRef = collection(db, "battles");
      const battlesQuery = query(
        battlesRef,
        where("tournamentId", "==", doc.id),
      );

      const countSnapshot = await getCountFromServer(battlesQuery);
      const battlesCount = countSnapshot.data().count;

      const tRow = document.createElement("tr");
      tRow.innerHTML = /*html*/ `
        <td>${tournamentData.name}</td>
        <td>${tournamentData.createdAt.toDate().toLocaleString("en-EN")}</td>
        <td>${battlesCount}</td> 
        <td>
          <button class="edit-tournament-button small-action-button" data-id="${doc.id}">
            <i class="bi bi-pencil"></i>
          </button>
        </td>  
      `;

      const editBtn = tRow.querySelector(".edit-tournament-button");
      editBtn.addEventListener("click", function () {
        showTournament(this.dataset.id);
      });

      tableBody.appendChild(tRow);
    }
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

async function newTournament() {
  const name = prompt("Enter tournament name:");
  if (!name || name === "") {
    alert("Name cannot be empty");
    return;
  }

  try {
    const tournamentsRef = collection(db, "tournaments");

    const newTournamentData = {
      createdAt: new Date(),
      author: loggedUser.uid,
      name,
    };

    const docRef = await addDoc(tournamentsRef, newTournamentData);

    showTournament(docRef.id);
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

let currentTournamentId;

async function showTournament(id) {
  currentTournamentId = id;
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
  PANELS.tournamentPanel.classList.remove("hidden");

  try {
    const tournamentsRef = collection(db, "tournaments");

    // get doc data by id
    const docSnapshot = await getDoc(doc(db, "tournaments", id));

    if (docSnapshot.exists()) {
      console.log("Doc data:", docSnapshot.data());
      const docData = docSnapshot.data();

      PANELS.tournamentPanel.querySelector("#tournament-name").innerHTML =
        `${docData.name}`;
    } else {
      alert("Doc not found!");
    }
  } catch (error) {
    console.error("Couldn't fetch data: ", error);
  }
}

//#endregion

//#region teams

async function createTeam() {
  try {
    const name = prompt("Enter team name:");
    if (!name || name === "") {
      alert("Please enter name");
      return;
    }

    // SQL: SELECT TABLE teams
    const teamsRef = collection(db, "teams");

    const newTeamData = {
      players: [],
      bucksBank: 0,
      createdAt: new Date(),
      author: loggedUser.uid,
      name,
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

      playersBox.insertAdjacentHTML(
        "beforeend",
        /*html*/ `
          <span style="font-size: 1.4rem; font-weight: bold;">${teamData.name}</span>
        `,
      );

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

async function addPlayerToTeam(teamId) {
  PANELS.addPlayerToTeam.classList.remove("hidden");

  document.querySelector("#new-player-name").value = "";
  document.querySelector("#new-player-id").value = "";
  document.querySelector("#team-id").value = teamId;
}

document.querySelector("#cancel-new-player").addEventListener("click", () => {
  document.querySelector("#new-player-name").value = "";
  document.querySelector("#new-player-id").value = "";
  document.querySelector("#team-id").value = null;
  PANELS.addPlayerToTeam.classList.add("hidden");
});

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

//#endregion

//#region battles

async function getTeamsMap() {
  // map is faster than array when searching
  const teamsMap = new Map();

  try {
    const teamsRef = collection(db, "teams");
    const querySnapshotTeams = await getDocs(teamsRef);

    querySnapshotTeams.forEach((doc) => {
      teamsMap.set(doc.id, doc.data());
    });

    return teamsMap;
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

async function showBattles() {
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
  PANELS.battlesPanel.classList.remove("hidden");

  try {
    const teamsMap = await getTeamsMap();

    const battlesRef = collection(db, "battles");
    const querySnapshotBattles = await getDocs(battlesRef);

    const battlesListDiv = PANELS.battlesPanel.querySelector("#battles-list");
    battlesListDiv.innerHTML = ``;

    querySnapshotBattles.forEach((doc) => {
      const battleData = doc.data();

      const battleTeams = battleData?.teams || [];

      if (battleTeams.length === 0) return;

      const battleDiv = document.createElement("div");
      battleDiv.className = "battle-div";

      const teamStrings = battleTeams.map((teamId) => {
        const teamData = teamsMap.get(teamId);

        return getPlayersString(teamData?.players || "error");
      });

      battleDiv.insertAdjacentHTML(
        "beforeend",
        teamStrings.join("&nbsp;vs&nbsp;"),
      );

      battleDiv.insertAdjacentHTML(
        "beforeend",
        `<button class="small-action-button go-to-battle-btn">${battleData?.closed ? "🔎" : `<i class="bi bi-pencil"></i>`}</button>`,
      );

      battleDiv
        .querySelector(".go-to-battle-btn")
        ?.addEventListener("click", () => {
          document
            .querySelectorAll(".panel")
            .forEach((p) => p.classList.add("hidden"));

          addTeamsToRecordTable();

          PANELS.battleGamePanel.classList.remove("hidden");
        });

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
document.querySelector("#cancel-battle-btn").addEventListener("click", (e) => {
  e.preventDefault();
  PANELS.createBattle.classList.add("hidden");
});

let selectedTeams = [];

const beginBattleButton = document.querySelector("#begin-battle-btn");
beginBattleButton.addEventListener("click", () => {
  if (selectedTeams.length < 2) return;

  createBattle(selectedTeams);
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

          beginBattleButton.disabled = selectedTeams.length < 2;
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

async function createBattle(teams) {
  try {
    const battlesRef = collection(db, "battles");

    const newBattleData = {
      teams,
      closed: false,
      createdAt: new Date(),
      author: loggedUser.uid,
      tournamentId: currentTournamentId,
    };

    const docRef = await addDoc(battlesRef, newBattleData);
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

//#endregion

//#region records

let teamsBattleTable = {};
let battleData = [];

async function addTeamsToRecordTable() {
  const battleRecordsTable = document.querySelector("#battle-records-table");
  if (!battleRecordsTable) {
    console.error("Battle records table not found");
    return;
  }

  battleRecordsTable.innerHTML = /*html*/ `
    <thead>
      <tr>
        <td colspan="2" rowspan="2">Team info</td>
        <!-- dynamic colspan change -->
        <td colspan="1" id="battles-header">Battles 
          <button id="new-battle-record-btn" class="small-action-button"><i class="bi bi-plus-circle"></i> new</button>
        </td>
      </tr>

      <tr id="record-number-row">
        <!-- dynamic cells inserting -->
      </tr>
    </thead>

    <tbody>
    </tbody>
  `;

  const teams = await getTeamsMap();

  battleRecordsTable
    .querySelector("#new-battle-record-btn")
    .addEventListener("click", () => {
      addBattleRecord(teams);
    });

  teams.forEach((team, key) => {
    teamsBattleTable[key] = {};

    const placementRow = document.createElement("tr");
    placementRow.id = `team-${key}-placement`;
    placementRow.innerHTML = /*html*/ `
      <td rowspan="4">Team ${team.name}
        ${getPlayersString(team.players)}
      </td>
      <td>Placement (1-12)</td>
    `;
    battleRecordsTable.querySelector("tbody").appendChild(placementRow);
    teamsBattleTable[key].placementRow = placementRow;

    const killsRow = document.createElement("tr");
    killsRow.id = `team-${key}-kills`;
    killsRow.innerHTML = /*html*/ `<td>Kills (0-12)</td>`;
    battleRecordsTable.querySelector("tbody").appendChild(killsRow);
    teamsBattleTable[key].killsRow = killsRow;

    const survivorsRow = document.createElement("tr");
    survivorsRow.id = `team-${key}-survivors`;
    survivorsRow.innerHTML = /*html*/ `<td>Survivors (0-5)</td>`;
    battleRecordsTable.querySelector("tbody").appendChild(survivorsRow);
    teamsBattleTable[key].survivorsRow = survivorsRow;

    const penaltyRow = document.createElement("tr");
    penaltyRow.id = `team-${key}-penalty`;
    penaltyRow.innerHTML = /*html*/ `<td>Penalty (>=0)</td>`;
    battleRecordsTable.querySelector("tbody").appendChild(penaltyRow);
    teamsBattleTable[key].penaltyRow = penaltyRow;
  });
}

function showBattleRecordInputs() {
  const battleRecordsTable = document.querySelector("#battle-records-table");
  if (!battleRecordsTable) {
    console.error("Battle records table not found");
    return;
  }
}

window.handleInput = function (input) {
  const category = input.dataset?.category;

  if (
    category !== "survivors" &&
    category !== "penalty" &&
    category !== "kills" &&
    category !== "placement"
  )
    return;

  const value = input.value;
  const parsedValue = parseInt(value, 10); // 10 - decimal system

  if (
    value !== "" &&
    (isNaN(parsedValue) || !Number.isInteger(Number(value)))
  ) {
    input.value = "";
    alert("Incorrect value");
    return;
  }

  const parentTD = input.parentElement;

  const teamId = parentTD.dataset.teamid;
  const recordId = parseInt(parentTD.dataset.recordid, 10);

  battleData[recordId - 1][teamId][category] = parsedValue;
  console.log({ battleData });
};

async function addBattleRecord() {
  if (Object.keys(teamsBattleTable).length === 0) {
    console.error("Could not add record to battle table");
    return;
  }

  const battleRecordsTable = document.querySelector("#battle-records-table");
  if (!battleRecordsTable) {
    console.error("Battle records table not found");
    return;
  }

  const teams = await getTeamsMap();

  const battlesAmount = battleData.length;

  battleData.push({});

  battleRecordsTable
    .querySelector("#record-number-row")
    //TODO save button
    .insertAdjacentHTML(
      "beforeend",
      /*html*/ `<td>${battlesAmount + 1} <button class="small-action-button" style="color: orange">save TODO</button></td>`,
    );

  battleRecordsTable.querySelector("thead tr td#battles-header").colSpan =
    battlesAmount + 1;

  teams.forEach((team, key) => {
    const teamTableRow = teamsBattleTable[key];
    if (!teamTableRow) {
      console.error("Team row not found");
      return;
    }

    teamTableRow.placementRow.insertAdjacentHTML(
      "beforeend",
      /*html*/ `<td data-teamid="${key}" data-recordid=${battlesAmount + 1}>
        <input 
          type="number"
          data-category="placement"
          class="battle-table-record-input"
          oninput="handleInput(this)"
          
          min="1"
          max="12"
          step="1"
          >
      </td>`,
    );

    teamTableRow.killsRow.insertAdjacentHTML(
      "beforeend",
      /*html*/ `<td data-teamid="${key}" data-recordid=${battlesAmount + 1}>
        <input 
          type="number"
          data-category="kills"
          class="battle-table-record-input"
          oninput="handleInput(this)"
          
          min="0"
          max="12"
          step="1"
          >
      </td>`,
    );

    teamTableRow.survivorsRow.insertAdjacentHTML(
      "beforeend",
      /*html*/ `<td data-teamid="${key}" data-recordid=${battlesAmount + 1}>
        <input 
          type="number"
          data-category="survivors"
          class="battle-table-record-input"
          oninput="handleInput(this)"
          
          min="0"
          max="5"
          step="1"
          >
      </td>`,
    );

    teamTableRow.penaltyRow.insertAdjacentHTML(
      "beforeend",
      /*html*/ `<td data-teamid="${key}" data-recordid=${battlesAmount + 1}>
        <input 
          type="number"
          data-category="penalty"
          class="battle-table-record-input"
          oninput="handleInput(this)"
          
          min="0"
          step="1"
          >
      </td>`,
    );

    battleData[battleData.length - 1][key] = {
      placement: null,
      kills: null,
      survivors: null,
      penalty: null,
    };

    console.log({ battleData });
  });
}

//#endregion
