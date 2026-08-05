//#region imports

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { db, auth } from "./admin/firebase.js";

import {
  collection, // table
  addDoc, // insert
  getDocs, // all docs
  doc, // specific doc (reference)
  getDoc, // specific doc (data)
  updateDoc, // update
  setDoc,
  arrayUnion,
  deleteDoc, // delete
  query,
  where,
  count,
  getCountFromServer,
  onSnapshot,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

//#endregion

onAuthStateChanged(auth, (user) => {
  if (user) {
    const userName = user.email.split("@")[0].toUpperCase();
    console.log("Logged user: ", { userName });

    document.querySelector("header").innerHTML =
      `<p>Logged as: ${userName}. Click to see admin panel: <a href="./admin/index.html">admin</a></p>`;
  } else document.querySelector("header").innerHTML = ``;
});

//#region listeners manager
const DB_STREAMS = {
  active: {
    tournament: null,
    activeTournamentsList: null,
  },

  stop(streamName) {
    if (this.active[streamName]) {
      this.active[streamName](); // Firebase unsubscribe
      this.active[streamName] = null;
    }
  },

  stopAll() {
    Object.keys(this.active).forEach((streamName) => this.stop(streamName));
  },
};
//#endregion

//#region panels switching
const PANELS = { ACTIVE_TOURNAMENTS: "Active Tournaments" };

function switchPanel(targetPanel) {
  DB_STREAMS.stopAll();

  if (targetPanel === PANELS.ACTIVE_TOURNAMENTS) {
    getActiveTournaments();
  }
}

switchPanel(PANELS.ACTIVE_TOURNAMENTS);
//#endregion

const container = document.querySelector("#leaderboard-data");

let unsubscribeActiveTournaments = null;

function getActiveTournaments() {
  DB_STREAMS.stopAll();

  try {
    const tournamentsRef = collection(db, "tournaments");

    const tournamentsQuery = query(tournamentsRef, where("active", "==", true));

    DB_STREAMS.active.activeTournamentsList = onSnapshot(
      tournamentsQuery,
      (querySnapshot) => {
        if (!container) {
          console.error("Leaderboard table not found");
          return;
        }
        container.innerHTML = "";
        document.querySelector("#container-name").innerHTML =
          `ACTIVE TOURNAMENTS`;

        querySnapshot.forEach((doc) => {
          const tournamentData = doc.data();
          const tournamentId = doc.id;

          container.insertAdjacentHTML(
            "beforeend",
            /*html*/ ` <div class="leaderboard-row rankClass">
                    <div class="row-indicator"></div>
                    <div class="player-info">
                      <span class="player-name">${tournamentData.name} by ${tournamentData.authorUsername}</span>
                    </div>
                    <div class="player-score">
                      <button class="small-action-button" onclick="showTournamentBattles('${tournamentId}')"><i class="bi bi-arrow-right"></i></button>
                    </div>
                  </div>`,
          );
        });
      },
      (error) => {
        console.error("Stream error (active tournaments): ", error);
      },
    );
  } catch (error) {
    console.error(
      "Couldn't setup real-time listener for active tournaments: ",
      error,
    );
  }
}

async function getTeamsMap(currentTournamentId) {
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

function getPlayersString(playersArray = []) {
  let string = `<p class="players-box">`;
  playersArray.forEach((p) => {
    string += `&nbsp;<span title="${p.inGameId || "no in-game id"}">${p.name || "player"}</span>`;
  });
  string += `</p>`;

  return string;
}

window.showTournamentBattles = async function (tournamentId) {
  DB_STREAMS.stopAll();

  try {
    const teamsMap = await getTeamsMap(tournamentId);

    const tournamentBattlesRef = collection(db, "battles");

    const tournamentBattlesQuery = query(
      tournamentBattlesRef,
      where("tournamentId", "==", tournamentId),
    );

    DB_STREAMS.active.tournament = onSnapshot(
      tournamentBattlesQuery,
      (querySnapshot) => {
        if (!container) {
          console.error("Leaderboard table not found");
          return;
        }
        container.innerHTML = "";
        document.querySelector("#container-name").innerHTML =
          `TOURNAMENT BATTLES`;

        querySnapshot.forEach((doc) => {
          const battleData = doc.data();

          const battleTeams = battleData?.teams || [];

          const teamStrings = battleTeams.map((teamId) => {
            const teamData = teamsMap.get(teamId);
            return {
              stringsArray: getPlayersString(teamData?.players || ["error"]),
              teamName: teamData.name,
            };
          });

          let teamsString = "";
          teamStrings.forEach((teamString) => {
            teamsString += `<p><strong>${teamString.teamName}</strong> - </p>${teamString.stringsArray}`;
          });

          container.insertAdjacentHTML(
            "beforeend",
            /*html*/ `
            <div class="leaderboard-row rankClass">
              <div class="row-indicator"></div>

               <div class="team-info">${teamsString}</div>
              
              <div class="player-score">
                <button class="small-action-button" onclick="showBattle('${doc.id}')"><i class="bi bi-arrow-right"></i></button>
              </div>
            </div>`,
          );
        });
      },
      (error) => {
        console.error("Stream error (tournament): ", error);
      },
    );
  } catch (error) {
    console.error("Couldn't setup real-time listener for tournament: ", error);
  }
};

window.showBattle = async function (battleId) {
  DB_STREAMS.stopAll();

  try {
    const battleRef = doc(db, "battles", battleId);

    DB_STREAMS.active.tournament = onSnapshot(
      battleRef,
      async (querySnapshot) => {
        if (!container) {
          console.error("Leaderboard table not found");
          return;
        }
        container.innerHTML = "";
        document.querySelector("#container-name").innerHTML = `BATTLE`;

        const battleDataRaw = querySnapshot.data();
        const battleDataRawRecords = battleDataRaw.records;

        const teamsMap = await getTeamsMap(battleDataRaw.tournamentId);

        // Object -> Array

        const battleData = Object.values(battleDataRawRecords || {});

        const displayData = battleData.reduce((map, battle) => {
          if (battle && battle.data) {
            Object.entries(battle.data).forEach(([teamId, stats]) => {
              if (!map[teamId]) {
                map[teamId] = {
                  kills: [],
                  penalty: [],
                  placement: [],
                  survivors: [],
                };
              }

              map[teamId].kills.push(stats.kills || 0);
              map[teamId].penalty.push(stats.penalty || 0);
              map[teamId].placement.push(stats.placement || 0);
              map[teamId].survivors.push(stats.survivors || 0);
            });
          }

          return map;
        }, {});

        /*
        === POINTS SYSTEM ===
        🏅 Placement Points

        🥇 1st Place: +3 Points
        🥈 2nd Place: +2 Points
        🥉 3rd Place: +1 Point
        4️⃣ 4th Place: 0 Points
        5️⃣ 5th Place: 0 Points

        ⚔️ Kill Points
        Every elimination is worth +2 Points.

        ⚠️ Rule Violations
        Any team found violating the tournament rules will receive a -3 Point deduction per violation. The tournament staff reserves the right to issue additional penalties or disqualifications for repeated or severe rule violations.
        */

        const teamsPoints = Object.entries(displayData).map(
          ([teamId, gamesData]) => {
            const placementPoints = gamesData.placement.reduce(
              // accumulator is the previous value
              (accumulator, placement) => {
                const points =
                  placement === 1
                    ? 3
                    : placement === 2
                      ? 2
                      : placement === 3
                        ? 1
                        : 0;

                return accumulator + points;
              },
              0, // base value
            );

            const killsPoints = gamesData.kills.reduce(
              // accumulator is the previous value
              (accumulator, kills) => {
                const points = kills * 2;

                return accumulator + points;
              },
              0, // base value
            );

            const penaltyPoints = gamesData.penalty.reduce(
              // accumulator is the previous value
              (accumulator, penalty) => {
                return accumulator + penalty;
              },
              0, // base value
            );

            const totalSurvivors = gamesData.survivors
              ? gamesData.survivors.reduce((accumulator, survivors) => {
                  return accumulator + survivors;
                }, 0)
              : 0;

            const teamData = teamsMap.get(teamId);

            return {
              teamId: teamId,
              points: placementPoints + killsPoints - penaltyPoints,
              players: teamData.players,
              killsPoints,
              placementPoints,
              penaltyPoints,
              totalSurvivors,
              teamName: teamData.name,
            };

            /*container.insertAdjacentHTML(
            "beforeend",
             `
            <div class="leaderboard-row rankClass">
              <div class="row-indicator"></div>

              <div class="team-info">teamId=${teamId}</div>
              
              <div class="player-score">
                <span class="score-val">${placementPoints + killsPoints - penaltyPoints}</span>
                <span class="score-label">PTS</span>
              </div>
            </div>`,
          );*/
          },
        );

        teamsPoints.sort((a, b) => {
          return (
            b.points - a.points || // 1. Sort by points
            b.killsPoints - a.killsPoints || // 2. Sort by kills
            b.totalSurvivors - a.totalSurvivors // 3. Sort by survivors
          );
        });

        let htmlContent = "";

        teamsPoints.forEach((team, index) => {
          const rank = index + 1;
          let rankClass = "";
          let crownSparkle = "";

          if (rank === 1) {
            rankClass = "rank-1";

            crownSparkle = '<span class="cyber-crown"></span>';
          } else if (rank === 2) {
            rankClass = "rank-2";
          } else if (rank === 3) {
            rankClass = "rank-3";
          }

          const formattedRank = rank < 10 ? `0${rank}` : rank;
          const formattedPoints = team.points.toLocaleString();

          htmlContent += `
            <div class="leaderboard-row ${rankClass}">
              <div class="row-indicator"></div>
              <div class="player-rank">${formattedRank}</div>
              <div class="player-info">
                <span class="player-name">${team.teamName}: ${getPlayersString(team.players)} ${crownSparkle}</span>
              </div>
              <div class="player-score">
                <span class="score-val">${formattedPoints}</span>
                <span class="score-label">PTS</span>
              </div>
            </div>
          `;
        });

        container.innerHTML = htmlContent;
      },
      (error) => {
        console.error("Stream error (battle): ", error);
      },
    );
  } catch (error) {
    console.error("Couldn't setup real-time listener for battle: ", error);
  }
};
