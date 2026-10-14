let allResources = [];
let currentCategory = "All";
let currentBuilding = null;

const searchBox = document.getElementById("searchBox");
const buttons = document.querySelectorAll(".cat-btn");
const mapBuildings = document.querySelectorAll(".building");
const mapStatus = document.getElementById("mapStatus");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModal");
const recommendedBox = document.getElementById("recommended");
const recommendedList = document.getElementById("recommendedList");
const resetHistoryBtn = document.getElementById("resetHistory");

/* ---------- Chhote helper functions ---------- */

function floorLabel(floor) {
  return floor === 0 ? "Ground floor" : "Floor " + floor;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isActive(item) {
  const today = new Date().toLocaleDateString("en-CA");
  return !(item.date && item.date < today);
}

function extraRows(item) {
  const rows = [];
  if (item.department) rows.push(["Department", item.department]);
  if (item.email) rows.push(["Email", item.email]);
  if (item.timing) rows.push(["Timing", item.timing]);
  if (item.date) rows.push(["Date", formatDate(item.date)]);

  return rows
    .map(([label, value]) => `<p><strong>${label}:</strong> ${value}</p>`)
    .join("");
}

/* ---------- Recommendation logic ---------- */

function similarityScore(a, b) {
  let score = 0;
  if (a.category === b.category) score += 2;
  if (a.building === b.building) score += 2;
  const shared = a.keywords.filter(k => b.keywords.includes(k)).length;
  score += shared * 3;
  return score;
}

function getSimilar(item) {
  return allResources
    .filter(other => other.id !== item.id && isActive(other))
    .map(other => ({ item: other, score: similarityScore(item, other) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.item);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("finderHistory")) || { tags: {}, viewed: [] };
  } catch (error) {
    return { tags: {}, viewed: [] };
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem("finderHistory", JSON.stringify(history));
  } catch (error) {
    /* storage band ho to koi baat nahi */
  }
}

function recordView(item) {
  const history = loadHistory();
  const tags = [item.category.toLowerCase(), ...item.keywords];

  tags.forEach(tag => {
    history.tags[tag] = (history.tags[tag] || 0) + 1;
  });

  if (!history.viewed.includes(item.id)) {
    history.viewed.push(item.id);
  }

  saveHistory(history);
}

function getRecommendations() {
  const history = loadHistory();

  return allResources
    .filter(item => isActive(item) && !history.viewed.includes(item.id))
    .map(item => {
      const tags = [item.category.toLowerCase(), ...item.keywords];
      const score = tags.reduce((sum, tag) => sum + (history.tags[tag] || 0), 0);
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.item);
}

function showRecommendations() {
  const list = getRecommendations();

  if (list.length === 0) {
    recommendedBox.classList.add("hidden");
    return;
  }

  recommendedList.innerHTML = "";
  list.forEach(item => recommendedList.appendChild(createCard(item)));
  recommendedBox.classList.remove("hidden");
}

/* ---------- Popup ---------- */

function openModal(item) {
  const keywordTags = item.keywords
    .map(word => `<span class="keyword">${word}</span>`)
    .join("");

  modalContent.innerHTML = `
    <span class="tag">${item.category}</span>
    <h2>${item.name}</h2>
    <p><strong>Building:</strong> ${item.building}</p>
    <p><strong>Room:</strong> ${item.room}</p>
    <p><strong>Floor:</strong> ${floorLabel(item.floor)}</p>
    ${extraRows(item)}
    <p><strong>Details:</strong> ${item.details}</p>
    <div class="keywords">${keywordTags}</div>
  `;

  const similar = getSimilar(item);
  if (similar.length > 0) {
    const box = document.createElement("div");
    box.className = "similar";
    box.innerHTML = "<h4>You Can Also Visit</h4>";

    similar.forEach(other => {
      const btn = document.createElement("button");
      btn.className = "similar-btn";
      btn.textContent = other.name + " (" + other.category + ")";
      btn.addEventListener("click", () => openModal(other));
      box.appendChild(btn);
    });

    modalContent.appendChild(box);
  }

  modal.classList.remove("hidden");

  recordView(item);
  showRecommendations();
}

function closeModal() {
  modal.classList.add("hidden");
}

/* ---------- Cards ---------- */

function createCard(item) {
  const dateLine = item.date
    ? `<p class="date">${formatDate(item.date)}</p>`
    : "";

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <span class="tag">${item.category}</span>
    <h3>${item.name}</h3>
    ${dateLine}
    <p>${item.building}, Room ${item.room} (${floorLabel(item.floor)})</p>
    <p>${item.details}</p>
  `;
  card.addEventListener("click", () => openModal(item));
  return card;
}

function showResources(list) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "<p class='empty'>Koi result nahi mila.</p>";
    return;
  }

  list.forEach(item => container.appendChild(createCard(item)));
}

/* ---------- Map ---------- */

function updateMapCounts() {
  mapBuildings.forEach(b => {
    const name = b.dataset.building;
    const count = allResources.filter(
      item => item.building === name && isActive(item)
    ).length;
    b.querySelector(".b-count").textContent =
      count + (count === 1 ? " place" : " places");
  });
}

function updateMapUI() {
  mapBuildings.forEach(b => {
    b.classList.toggle("selected", b.dataset.building === currentBuilding);
  });

  if (currentBuilding) {
    mapStatus.innerHTML = `Showing only <strong>${currentBuilding}</strong>
      <button id="clearBuilding">Show all buildings</button>`;

    document.getElementById("clearBuilding").addEventListener("click", () => {
      currentBuilding = null;
      updateMapUI();
      applyFilters();
    });
  } else {
    mapStatus.textContent = "Click a building to see what is inside it.";
  }
}

/* ---------- Filters ---------- */

function applyFilters() {
  const text = searchBox.value.toLowerCase().trim();

  const filtered = allResources.filter(item => {
    if (!isActive(item)) return false;

    const matchesCategory =
      currentCategory === "All" || item.category === currentCategory;

    const matchesBuilding =
      !currentBuilding || item.building === currentBuilding;

    const searchable = [
      item.name,
      item.category,
      item.building,
      item.room,
      item.details,
      item.department || "",
      item.timing || "",
      ...item.keywords
    ].join(" ").toLowerCase();

    return matchesCategory && matchesBuilding && searchable.includes(text);
  });

  if (currentCategory === "Event") {
    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  showResources(filtered);
}

/* ---------- Events ---------- */

searchBox.addEventListener("input", applyFilters);

buttons.forEach(button => {
  button.addEventListener("click", () => {
    currentCategory = button.dataset.category;

    buttons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    applyFilters();
  });
});

mapBuildings.forEach(b => {
  b.addEventListener("click", () => {
    const name = b.dataset.building;
    currentBuilding = currentBuilding === name ? null : name;
    updateMapUI();
    applyFilters();
  });
});

resetHistoryBtn.addEventListener("click", () => {
  try {
    localStorage.removeItem("finderHistory");
  } catch (error) {
    /* ignore */
  }
  showRecommendations();
});

closeModalBtn.addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
  }
});

/* ---------- Shuruaat ---------- */

fetch("data.json")
  .then(response => response.json())
  .then(data => {
    allResources = data;
    updateMapCounts();
    updateMapUI();
    applyFilters();
    showRecommendations();
  });