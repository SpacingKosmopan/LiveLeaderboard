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
  setDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc, // delete
  query,
  where,
  count,
  getCountFromServer,
  onSnapshot,
  orderBy,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

//#endregion

//#region login
const DB_STREAMS = {
  active: {},

  stop(streamName) {
    if (this.active[streamName]) {
      this.active[streamName](); // Firebase unsubscribe
      this.active[streamName] = null;
    }
  },

  start(name, unsubscribe) {
    this.stop(name);
    this.active[name] = unsubscribe;
  },

  stopAll() {
    Object.keys(this.active).forEach((streamName) => this.stop(streamName));
  },
};

function openPanel(panel) {
  DB_STREAMS.stopAll();

  document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));

  panel.classList.remove("hidden");
}

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
      openPanel(PANELS.tournamentPanel);
      showTournament(currentTournamentId);
    }),
  );

  document.querySelectorAll(".back-to-admin-btn").forEach((b) =>
    b.addEventListener("click", () => {
      openPanel(PANELS.adminPanel);
      showAllTournaments();
    }),
  );

  document.querySelector("#mng-teams-btn").addEventListener("click", showTeams);
  document
    .querySelector("#mng-battles-btn")
    .addEventListener("click", showBattles);
  document
    .querySelector("#change-visibility-btn")
    .addEventListener("click", changeTournamentVisibility);
  document
    .querySelector("#invite-comanager-btn")
    .addEventListener("click", inviteComanager);
});

let loggedUser = null;

// login state change
onAuthStateChanged(auth, (user) => {
  openPanel(PANELS.adminPanel);

  if (user) {
    loggedUser = user;

    const userName = user.email.split("@")[0].toUpperCase();
    console.log("Logged user: ", { userName });

    errorMsg.innerText = "";

    PANELS.adminPanel.innerHTML = /*html*/ `
      <div>
        <p style="display: inline-block;">Logged user: <strong>${userName}</strong></p>
        <button id="see-leaderboard-btn" class="action-button"><i class="bi bi-award"></i> See leaderboard</button>
        <button id="logout-btn" class="action-button"><i class="bi bi-door-open"></i> Log out</button>
      </div> <hr />
      <p>Your tournaments</p>
        <table id="tournaments-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Author</th>
              <th>Creation date</th>
              <th>Battles amount</th>
              <th>Status</th>
              <th>Actions <button id="new-tournament-btn" class="small-action-button"><i class="bi bi-plus-circle"></i> new</button></th>
            </tr>
          </thead>
          <tbody>

          </tbody>
        </table>
    `;
    document
      .querySelector("#see-leaderboard-btn")
      .addEventListener("click", () => {
        window.location.href = `../index.html`;
      });
    document
      .querySelector("#new-tournament-btn")
      .addEventListener("click", newTournament);
    document.querySelector("#logout-btn").addEventListener("click", () => {
      signOut(auth);
    });

    showAllTournaments();
  } else {
    loggedUser = null;
  }
});

//#endregion

//#region tournaments

async function showAllTournaments() {
  if (!loggedUser) {
    console.warn("User is not logged in");
    return;
  }

  try {
    const tournamentsTable = document.querySelector("#tournaments-table");
    if (!tournamentsTable) {
      console.error("Tournaments table not found");
      return;
    }
    const tableBody = tournamentsTable.querySelector("tbody");
    tableBody.innerHTML = "";

    const tournamentsRef = collection(db, "tournaments");
    const tournamentQuery = query(tournamentsRef, orderBy("createdAt", "desc"));

    DB_STREAMS.start(
      "tournaments",
      onSnapshot(
        tournamentQuery,
        async (querySnapshot) => {
          tableBody.innerHTML = "";

          // for ... of allows await
          for (const doc of querySnapshot.docs) {
            if (!loggedUser) {
              tableBody.innerHTML = "";
              return;
            }

            const userName = loggedUser.email.split("@")[0].toLowerCase();

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
            <td>${tournamentData.name || "No name"}</td>
            <td>${tournamentData.authorUsername || "missing name"}</td>
            <td>${tournamentData.createdAt?.toDate()?.toLocaleString("en-GB") || ""}</td>
            <td>${battlesCount}</td> 
            <td>${tournamentData.active ? `<i class="bi bi-check-circle-fill"></i> active` : `<i class="bi bi-x-circle-fill"></i> inactive`}</td>
            <td>
              ${
                //* owner
                tournamentData.author === loggedUser?.uid
                  ? `<span style="background-color: #0b7346; border-radius: 5px; padding: 3px;">owner</span> <button class="edit-tournament-button small-action-button" data-id="${doc.id}">
                <i class="bi bi-pencil"></i>
              </button>`
                  : //* comanager
                    tournamentData.comanagers.includes(userName)
                    ? `<span style="background-color: #530873; border-radius: 5px; padding: 3px;">invited</span> <button class="edit-tournament-button small-action-button" data-id="${doc.id}">
                <i class="bi bi-pencil"></i>`
                    : //* no permissions
                      ""
              }
            </td>  
          `;

            const editBtn = tRow.querySelector(".edit-tournament-button");
            editBtn?.addEventListener("click", function () {
              DB_STREAMS.stop("tournaments");
              showTournament(this.dataset.id);
            });

            tableBody.appendChild(tRow);
          }
        },
        (error) => {
          console.error("Error tournaments listening: ", error);
        },
      ),
    );
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

    const userName = loggedUser.email.split("@")[0].toUpperCase();

    const newTournamentData = {
      name,
      createdAt: new Date(),
      author: loggedUser.uid,
      authorUsername: userName,
      active: false,
    };

    const docRef = await addDoc(tournamentsRef, newTournamentData);

    showTournament(docRef.id);
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

let currentTournamentId;

function showTournament(id) {
  currentTournamentId = id;

  openPanel(PANELS.tournamentPanel);

  try {
    const docRef = doc(db, "tournaments", id);

    DB_STREAMS.start(
      "tournament",
      onSnapshot(
        docRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const docData = docSnapshot.data();

            PANELS.tournamentPanel.querySelector("#tournament-name").innerHTML =
              `${docData.name}`;

            PANELS.tournamentPanel.querySelector("#tournament-info").innerHTML =
              `${
                docData.active
                  ? `<i class="bi bi-info-circle"></i> Your tournament is active and leaderboard is visible for everyone. Click button to deactivate`
                  : `<i class="bi bi-info-circle"></i> Your tournament is not active. Noone can see the leaderboard. Click button to make it public`
              }`;
          } else {
            alert("Doc not found!");
          }
        },
        (error) => {
          console.error("Stream error: ", error);
        },
      ),
    );
  } catch (error) {
    console.error("Couldn't setup real-time listener: ", error);
  }
}

async function changeTournamentVisibility(event) {
  const button = event.currentTarget;
  button.disabled = true;

  const tournamentRef = doc(db, "tournaments", currentTournamentId);

  try {
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(tournamentRef);
      if (!sfDoc.exists()) {
        throw "Tournament doc not found";
      }

      const currentActive = sfDoc.data().active;
      transaction.update(tournamentRef, { active: !currentActive });
    });
  } catch (error) {
    console.error("Database operation failed: ", error);
  } finally {
    button.disabled = false;
  }
}

async function inviteComanager() {
  const name = prompt("Enter username:").trim().toLowerCase();

  if (name === null) return;

  if (name === "") {
    alert("Invalid username");
    return;
  }

  const teamDocRef = doc(db, "tournaments", currentTournamentId);

  try {
    await updateDoc(teamDocRef, {
      comanagers: arrayUnion(name),
    });

    alert("Co-manager successfuly added");
  } catch (error) {
    console.error("Couldn't add player to team: ", error);
  }
}

//#endregion

//#region teams

async function createTeam() {
  try {
    const name = prompt("Enter team name:");

    if (name === null) {
      // canceled
      return;
    }

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
      tournamentId: currentTournamentId,
    };

    // SQL: INSERT INTO teams() VALUES ()
    const docRef = await addDoc(teamsRef, newTeamData);
    await showTeams();
  } catch (error) {
    console.error("Couldn't insert data to database: ", error);
  }
}

async function deleteTeam(teamId) {
  const answer = confirm("Are you sure you want to delete this team?");
  if (!answer) return;

  // SQL: SELECT
  const docRef = doc(db, "teams", teamId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Couldn't delete data from database: ", error);
  }
}

document.querySelector("#add-team-btn").addEventListener("click", createTeam);

function showTeams() {
  openPanel(PANELS.teamsPanel);

  const teamsListDiv = document.querySelector("#teams-list");
  teamsListDiv.innerHTML = ``;

  const teamsRef = collection(db, "teams");
  const teamQuery = query(
    teamsRef,
    where("tournamentId", "==", currentTournamentId),
  );

  const unsubscribe = onSnapshot(
    teamQuery,
    (querySnapshot) => {
      teamsListDiv.innerHTML = ``;

      querySnapshot.forEach((doc) => {
        const teamDiv = document.createElement("div");
        teamDiv.className = "team-div";
        teamDiv.innerHTML = /*html*/ `
          <button title="Add player to team" class="add-player-btn small-action-button" data-teamid="${doc.id}" style="background-color: #050;">+ player</button>
        `;

        teamDiv.insertAdjacentHTML(
          "beforeend",
          /*html*/ `
          <button title="Delete team" class="delete-team-btn small-action-button" data-teamid="${doc.id}" style="background-color:#500;">- team</button>
          `,
        );

        teamDiv
          .querySelector(".add-player-btn")
          .addEventListener("click", function () {
            addPlayerToTeam(this.dataset.teamid);
          });

        teamDiv
          .querySelector(".delete-team-btn")
          .addEventListener("click", function () {
            deleteTeam(this.dataset.teamid);
          });

        const teamData = doc.data();

        const playersBox = document.createElement("p");
        playersBox.className = "players-box";

        playersBox.insertAdjacentHTML(
          "beforeend",
          /*html*/ `
            <span style="font-size: 1.4rem; font-weight: bold;">${teamData.name}</span>
          `,
        );

        const players = teamData.players || [];
        players.forEach((player, index) => {
          playersBox.insertAdjacentHTML(
            "beforeend",
            /*html*/ `
            <span 
              title="${player.inGameId || "no in-game id"}" 
              data-teamid="${doc.id}" 
              data-playernumber="${index}"
              ondblclick="removePlayerFromTeam(this)"
            >
              ${player.name || "player"}
            </span>
          `,
          );
        });

        teamDiv.appendChild(playersBox);
        teamsListDiv.appendChild(teamDiv);
      });
    },
    (error) => {
      console.error("Firestore error: ", error);
    },
  );

  DB_STREAMS.start("teams", unsubscribe);
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
  if (playerName === null) {
    return;
  }

  if (playerName === "") {
    alert("Please insert player name");
    return;
  }

  PANELS.addPlayerToTeam.classList.add("hidden");

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
  } catch (error) {
    console.error("Couldn't add player to team: ", error);
  }
});

window.removePlayerFromTeam = async function (source) {
  const userConfirmed = confirm(
    "Are you sure you want to remove player from team?",
  );

  if (!userConfirmed) {
    return;
  }

  const teamId = source.dataset.teamid;
  const playerIndex = parseInt(source.dataset.playernumber, 10);

  if (!teamId || isNaN(playerIndex)) {
    console.error("Missing teamId or valid player index");
    return;
  }

  const teamDocRef = doc(db, "teams", teamId);

  try {
    const teamSnapshot = await getDoc(teamDocRef);

    if (!teamSnapshot.exists()) {
      console.error("Team not found");
      return;
    }

    const teamData = teamSnapshot.data();
    const playersArray = teamData.players || [];

    if (playersArray.length <= 1) {
      alert("Cannot delete player. Team must have at least one player.");
      return;
    }

    const playerToRemove = playersArray[playerIndex];
    if (!playerToRemove) {
      console.error("Player not found at index: ", playerIndex);
      return;
    }

    await updateDoc(teamDocRef, {
      players: arrayRemove(playerToRemove),
    });

    await showTeams();
    console.log("Player removed successfully");
  } catch (error) {
    console.error("Couldn't remove player from team: ", error);
  }
};

//#endregion

//#region battles

async function getTeamsMap() {
  // map is faster than array when searching
  const teamsMap = new Map();

  try {
    const teamsRef = collection(db, "teams");
    const querySnapshotTeams = await getDocs(
      query(teamsRef, where("tournamentId", "==", currentTournamentId)),
    );

    querySnapshotTeams.forEach((doc) => {
      teamsMap.set(doc.id, doc.data());
    });

    return teamsMap;
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

let currentBattleId = null;
let currentBattleTeamsId = [];

async function showBattles() {
  openPanel(PANELS.battlesPanel);

  try {
    const teamsMap = await getTeamsMap();

    const battlesListDiv = PANELS.battlesPanel.querySelector("#battles-list");
    battlesListDiv.innerHTML = ``;

    const battlesRef = collection(db, "battles");
    const battlesQuery = query(
      battlesRef,
      where("tournamentId", "==", currentTournamentId),
    );

    // Zamiast getDocs tworzymy subskrypcję czasu rzeczywistego
    DB_STREAMS.start(
      "battles",
      onSnapshot(
        battlesQuery,
        (querySnapshotBattles) => {
          battlesListDiv.innerHTML = ``;

          querySnapshotBattles.forEach((doc) => {
            const battleData = doc.data();
            const battleTeams = battleData?.teams || [];

            if (battleTeams.length === 0) return;

            const battleDiv = document.createElement("div");
            battleDiv.className = "battle-div";

            const teamStrings = battleTeams.map((teamId) => {
              const teamData = teamsMap.get(teamId);
              return getPlayersString(teamData?.players || ["error"]);
            });

            battleDiv.insertAdjacentHTML(
              "beforeend",
              teamStrings.join("&nbsp;vs&nbsp;"),
            );

            battleDiv.insertAdjacentHTML(
              "beforeend",
              /*html*/
              `<button class="small-action-button go-to-battle-btn" style="background-color: #0bb54f;">${battleData?.closed ? "🔎" : `<i class="bi bi-pencil"></i>`}</button>
              <button class="small-action-button remove-battle-btn" style="background-color: #b50b3b;"><i class="bi bi-trash"></i></button>
              `,
            );

            battleDiv
              .querySelector(".go-to-battle-btn")
              ?.addEventListener("click", async () => {
                document
                  .querySelectorAll(".panel")
                  .forEach((p) => p.classList.add("hidden"));

                currentBattleId = doc.id;
                currentBattleTeamsId = battleTeams;

                await addTeamsToRecordTable(battleData.teams);
                renderRecordTableData(teamsMap);

                PANELS.battleGamePanel.classList.remove("hidden");
              });

            battleDiv
              .querySelector(".remove-battle-btn")
              ?.addEventListener("click", () => {
                deleteBattle(doc.id);
              });

            battlesListDiv.appendChild(battleDiv);
          });
        },
        (error) => {
          console.error("Battles listening error: ", error);
        },
      ),
    );
  } catch (error) {
    console.error("Couldn't get data from database: ", error);
  }
}

function getPlayersString(playersArray = []) {
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
  const teamsQuery = query(
    teamsRef,
    where("tournamentId", "==", currentTournamentId),
  );
  try {
    const querySnapshot = await getDocs(teamsQuery);

    querySnapshot.forEach((doc) => {
      const teamData = doc.data();
      if (teamData.players.length === 0) return;

      const teamDiv = document.createElement("div");

      teamDiv.className = "team-card";

      teamDiv.innerHTML = /*html*/ `
      <div class="team-card-header">
        <h3>${teamData.name}</h3>
        <input type="checkbox" class="select-team-checkbox small-action-button" data-teamid="${doc.id}" />
      </div>
      <div class="players-box"></div>
    `;

      const checkbox = teamDiv.querySelector(".select-team-checkbox");

      teamDiv.addEventListener("click", function (e) {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      });

      checkbox.addEventListener("change", function (e) {
        if (this.checked) {
          if (!selectedTeams.includes(this.dataset.teamid)) {
            selectedTeams.push(this.dataset.teamid);
          }
          teamDiv.classList.add("selected");
        } else {
          selectedTeams = selectedTeams.filter(
            (teamId) => teamId !== this.dataset.teamid,
          );
          teamDiv.classList.remove("selected");
        }

        beginBattleButton.disabled = selectedTeams.length < 2;
      });

      const playersBox = teamDiv.querySelector(".players-box");

      teamData?.players.forEach((player) => {
        playersBox.insertAdjacentHTML(
          "beforeend",
          /*html*/ `
          <span class="player-tag" title="${player.inGameId || "no in-game id"}">
            ${player.name || "player"}
          </span>
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

async function deleteBattle(battleId) {
  if (!battleId) {
    console.error("Missing battleId");
    return;
  }

  const userConfirmed = confirm("Are you sure you want to delete this battle?");
  if (!userConfirmed) {
    return;
  }

  try {
    const battleDocRef = doc(db, "battles", battleId);

    await deleteDoc(battleDocRef);

    console.log("Battle deleted successfully");
  } catch (error) {
    console.error("Couldn't delete battle from database: ", error);
  }
}

//#endregion

//#region records

let teamsBattleTable = {};
let battleData = [];
let editingRecords = [];

/**
 * Creates table structure (teams -> rows)
 * @returns
 */
async function addTeamsToRecordTable(teamsIdArray = []) {
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

  teams.forEach((team, key) => {
    if (!teamsIdArray.includes(key)) {
      return;
    }

    teamsBattleTable[key] = {};

    const placementRow = document.createElement("tr");
    placementRow.id = `team-${key}-placement`;
    placementRow.classList.add("placement-row");
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

  battleRecordsTable
    .querySelector("#new-battle-record-btn")
    .addEventListener("click", async () => {
      if (typeof addBattleRecord === "function") {
        addBattleRecord(teams);
      }
    });

  renderRecordTableData(teams);
}

function renderRecordTableData(teams) {
  const battleRef = doc(db, "battles", currentBattleId);

  DB_STREAMS.start(
    "battle",
    onSnapshot(
      battleRef,
      (battleSnapshot) => {
        if (battleSnapshot.exists()) {
          battleData = [];
          window.lastFirebaseRecordsSnapshot = {};

          if (battleSnapshot.data().records) {
            const records = battleSnapshot.data().records;

            Object.keys(records)
              .sort((a, b) => Number(a) - Number(b))
              .forEach((id) => {
                const actualData = records[id].data || {};
                battleData.push(actualData);

                const recordIndex = battleData.length - 1;
                window.lastFirebaseRecordsSnapshot[recordIndex] = JSON.parse(
                  JSON.stringify(actualData),
                );
              });
          }

          showBattleRecordInputs(teams);

          console.log("Updated data:", battleData);
        } else {
          console.log("Document not found");
        }
      },
      (error) => {
        console.error("Listening error: ", error);
      },
    ),
  );
}

function showBattleRecordInputs(teams) {
  const battleRecordsTable = document.querySelector("#battle-records-table");
  if (!battleRecordsTable) return;

  document.querySelector("#record-number-row").innerHTML = "";

  currentBattleTeamsId.forEach((key) => {
    const rows = [
      teamsBattleTable[key].placementRow,
      teamsBattleTable[key].killsRow,
      teamsBattleTable[key].survivorsRow,
      teamsBattleTable[key].penaltyRow,
    ];
    rows.forEach((row, index) => {
      const keepCount = index === 0 ? 2 : 1;
      while (row.cells.length > keepCount) {
        row.deleteCell(-1);
      }
    });
  });

  const totalBattles = battleData.length;
  document.querySelector("#battles-header").colSpan =
    totalBattles > 0 ? totalBattles : 1;

  battleData.forEach((battleRecord, recordId) => {
    const isEditing = editingRecords.includes(recordId);

    const headerCell = document.createElement("td");
    headerCell.id = `record-${recordId}-action-cell`;

    if (isEditing) {
      headerCell.innerHTML = `
    ${recordId + 1} 
    <button class="small-action-button" style="color: orange" data-recordid="${recordId}" data-action="save" title="Save"><i class="bi bi-floppy"></i></button>
    <button class="small-action-button" style="color: crimson" data-recordid="${recordId}" data-action="cancel" title="Cancel"><i class="bi bi-x-circle"></i></button>
  `;
    } else {
      headerCell.innerHTML = `
    ${recordId + 1} 
    <button class="small-action-button" style="color: dodgerblue" data-recordid="${recordId}" data-action="edit" title="Edit"><i class="bi bi-pencil"></i></button>
  `;
    }
    document.querySelector("#record-number-row").appendChild(headerCell);

    headerCell.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const rId = parseInt(btn.dataset.recordid);
        const action = btn.dataset.action;

        if (action === "edit") {
          editingRecords.push(rId);
          showBattleRecordInputs(teams);
        } else if (action === "save") {
          saveBattleData(rId, teams);
        } else if (action === "cancel") {
          cancelBattleEdit(rId, teams);
        }
      });
    });

    currentBattleTeamsId.forEach((teamKey) => {
      const teamData = battleRecord[teamKey] || {
        placement: null,
        kills: null,
        survivors: null,
        penalty: null,
      };

      const getCellContent = (category, value, min, max) => {
        if (isEditing) {
          return `<input 
            type="number" 
            value="${value ?? ""}" 
            data-category="${category}" 
            class="battle-table-record-input" 
            oninput="handleInput(this)"
            ${min !== undefined ? `min="${min}"` : ""} 
            ${max !== undefined ? `max="${max}"` : ""} 
            step="1">`;
        } else {
          return `<span>${value ?? "-"}</span>`;
        }
      };

      teamsBattleTable[teamKey].placementRow.insertAdjacentHTML(
        "beforeend",
        `<td data-teamid="${teamKey}" data-recordid="${recordId}">${getCellContent("placement", teamData.placement, 1, 12)}</td>`,
      );

      teamsBattleTable[teamKey].killsRow.insertAdjacentHTML(
        "beforeend",
        `<td data-teamid="${teamKey}" data-recordid="${recordId}">${getCellContent("kills", teamData.kills, 0, 12)}</td>`,
      );

      teamsBattleTable[teamKey].survivorsRow.insertAdjacentHTML(
        "beforeend",
        `<td data-teamid="${teamKey}" data-recordid="${recordId}">${getCellContent("survivors", teamData.survivors, 0, 5)}</td>`,
      );

      teamsBattleTable[teamKey].penaltyRow.insertAdjacentHTML(
        "beforeend",
        `<td data-teamid="${teamKey}" data-recordid="${recordId}">${getCellContent("penalty", teamData.penalty, 0)}</td>`,
      );
    });
  });
}

function cancelBattleEdit(recordId, teams) {
  editingRecords = editingRecords.filter((id) => id !== recordId);

  const isNewUnsaved = !window.lastFirebaseRecordsSnapshot?.[recordId];

  if (recordId === battleData.length - 1 && isNewUnsaved) {
    battleData.pop();
  } else if (!isNewUnsaved) {
    battleData[recordId] = JSON.parse(
      JSON.stringify(window.lastFirebaseRecordsSnapshot[recordId]),
    );
  }

  showBattleRecordInputs(teams);
}

const INPUT_VALUE_RANGES = {
  placement: { min: 1, max: 12 },
  kills: { min: 0, max: 12 },
  survivors: { min: 0, max: 5 },
  penalty: { min: 0, max: 9999 },
};

/**
 * Saves input data to local battleData variable
 * @param {*} input
 * @returns
 */
window.handleInput = function (input) {
  const category = input.dataset?.category;

  if (!["survivors", "penalty", "kills", "placement"].includes(category))
    return;

  const value = input.value.trim();

  if (value === "") {
    const parentTD = input.parentElement;
    const teamId = parentTD.dataset.teamid;
    const recordId = parseInt(parentTD.dataset.recordid, 10);

    if (battleData[recordId]?.[teamId]) {
      battleData[recordId][teamId][category] = null;
    }
    return;
  }

  // numbers only
  if (!/^-?\d+$/.test(value)) {
    input.value = "";
    alert("Incorrect value");
    return;
  }

  const parsedValue = parseInt(value, 10);
  const parentTD = input.parentElement;
  const teamId = parentTD.dataset.teamid;
  const recordId = parseInt(parentTD.dataset.recordid, 10);

  if (
    parsedValue < INPUT_VALUE_RANGES[category].min ||
    parsedValue > INPUT_VALUE_RANGES[category].max
  ) {
    input.value = "";
    alert("Incorrect value");
    return;
  }

  if (battleData[recordId]?.[teamId]) {
    battleData[recordId][teamId][category] = parsedValue;
  } else console.error("Structure not found");
};

/**
 * Creates Column with inputs (new record)
 * @returns
 */
async function addBattleRecord() {
  if (Object.keys(teamsBattleTable).length === 0) {
    console.error("Could not add record to battle table");
    return;
  }

  const teams = await getTeamsMap();
  const battlesAmount = battleData.length;

  const newRecord = {};
  currentBattleTeamsId.forEach((key) => {
    newRecord[key] = {
      placement: null,
      kills: null,
      survivors: null,
      penalty: null,
    };
  });

  battleData.push(newRecord);

  editingRecords.push(battlesAmount);

  showBattleRecordInputs(teams);
}

async function saveBattleData(recordId, teams) {
  const battleRef = doc(db, "battles", currentBattleId);

  console.log(battleData[recordId]);

  const data = {
    [`records.${recordId}`]: {
      lastSaved: new Date(),
      lastAuthor: loggedUser.uid,
      data: battleData[recordId],
    },
  };

  try {
    await updateDoc(battleRef, data);

    editingRecords = editingRecords.filter((id) => id !== recordId);

    showBattleRecordInputs(teams);

    console.log("Saved successfully");
  } catch (error) {
    console.error("Couldn't update data in database: ", error);
  }
}

//#endregion
