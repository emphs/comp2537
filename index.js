
function setup () {

  const DIFFICULTY_SETTINGS = {
    easy: { pairs: 6, time: 30 },
    medium: { pairs: 10, time: 90 },
    hard: { pairs: 15, time: 60 },
  };

  const body = document.body;
  const difficultySelect = document.getElementById('difficulty-select');
  const themeSelect = document.getElementById('theme-select');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const powerUpBtn = document.getElementById('powerup-btn');
  const statusHeader = document.getElementById('status-header');
  const gameBoard = document.getElementById('game-board');
  const gameMessage = document.getElementById('game-message');

  let cards = [];

  let flippedCards = [];

  let clicks = 0;
  let pairsMatched = 0;
  let pairsLeft = 0;
  let timer = 0;
  let timerInterval = null;
  let powerUpCooldown = 0;
  let powerUpCooldownInterval = null;
  let gameStatus = 'notStarted';

  let difficulty = difficultySelect.value;
  let theme = themeSelect.value;

  const usedPokemonIdsKey = 'usedPokemonIds';

  function getRandomUniqueNumbers(count, max, excludeSet = new Set()) {
    const numbers = new Set();
    while (numbers.size < count) {
      const n = Math.floor(Math.random() * max) + 1;
      if (!excludeSet.has(n)) numbers.add(n);
    }
    return Array.from(numbers);
  }

  async function fetchPokemonData(pokeIds) {
    const promises = pokeIds.map(async (id) => {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch Pokémon with ID ${id}`);
      const data = await res.json();
      return {
        id,
        name: data.name,
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default || '',
      };
    });
    return Promise.all(promises);
  }

  function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateStatus() {
    if (gameStatus === 'notStarted') {
      statusHeader.textContent = 'Please start the game.';
    } else if (gameStatus === 'loading') {
      statusHeader.textContent = 'Loading Pokémon...';
    } else if (gameStatus === 'playing') {
      statusHeader.textContent = `Time left: ${timer}s | Clicks: ${clicks} | Pairs matched: ${pairsMatched} | Pairs left: ${pairsLeft} | Total pairs: ${DIFFICULTY_SETTINGS[difficulty].pairs}`;
    } else if (gameStatus === 'won') {
      statusHeader.textContent = `You won!`;
    } else if (gameStatus === 'lost') {
      statusHeader.textContent = `Time's up, Game over.`;
    }
  }

  function renderCards() {
    gameBoard.innerHTML = '';
    const totalCards = cards.length;
    const cols = Math.min(6, Math.ceil(Math.sqrt(totalCards)));
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, var(--card-width))`;

    cards.forEach((card, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('card');
      if (card.flipped || card.matched) cardDiv.classList.add('flipped');
      if (card.matched) cardDiv.classList.add('matched');
      cardDiv.dataset.index = idx;

      if (card.flipped || card.matched) {
        if (card.image) {
          const img = document.createElement('img');
          img.src = card.image;
          img.alt = card.name;
          cardDiv.appendChild(img);
        } else {
          cardDiv.textContent = card.name;
        }
      } else {
        const backImg = document.createElement('img');
        backImg.src = 'back.webp'; 
        backImg.alt = 'Card back';
        cardDiv.appendChild(backImg);
      }


      cardDiv.addEventListener('click', () => onCardClick(idx));

      gameBoard.appendChild(cardDiv);
    });
  }

  function onCardClick(index) {
    if (gameStatus !== 'playing') return;
    if (powerUpCooldown > 0 && powerUpActive) return;

    if (cards[index].flipped || cards[index].matched) return;
    if (flippedCards.length === 2) return;
    cards[index].flipped = true;
    flippedCards.push(index);
    clicks++;
    updateStatus();
    renderCards();

    if (flippedCards.length === 2) {
      checkForMatch();
    }
  }

  function checkForMatch() {
    const [i1, i2] = flippedCards;
    const c1 = cards[i1];
    const c2 = cards[i2];

    if (c1.id === c2.id) {

      c1.matched = true;
      c2.matched = true;
      pairsMatched++;
      pairsLeft--;
      flippedCards = [];
      updateStatus();
      renderCards();

      if (pairsLeft === 0) {
        gameStatus = 'won';
        clearInterval(timerInterval);
        updateStatus();
        showMessage('You won!');
        powerUpBtn.disabled = true;
      }
    } else {

      setTimeout(() => {
        c1.flipped = false;
        c2.flipped = false;
        flippedCards = [];
        renderCards();
      }, 1000);
    }
  }

  function showMessage(msg) {
    gameMessage.textContent = msg;
  }

  function clearMessage() {
    gameMessage.textContent = '';
  }

  async function startGame() {
    difficulty = difficultySelect.value;
    theme = themeSelect.value;
    setTheme(theme);

    gameStatus = 'loading';
    updateStatus();
    clearMessage();
    powerUpBtn.disabled = true;
    clearInterval(timerInterval);
    clearInterval(powerUpCooldownInterval);
    powerUpCooldown = 0;
    powerUpBtn.textContent = 'Power-Up';

    clicks = 0;
    pairsMatched = 0;
    pairsLeft = DIFFICULTY_SETTINGS[difficulty].pairs;
    timer = DIFFICULTY_SETTINGS[difficulty].time;
    flippedCards = [];
    cards = [];

    renderCards();

    let usedIds = new Set();
    try {
      const stored = sessionStorage.getItem(usedPokemonIdsKey);
      if (stored) {
        usedIds = new Set(JSON.parse(stored));
      }
    } catch {}

    const neededPairs = DIFFICULTY_SETTINGS[difficulty].pairs;
    const availableCount = 800 - usedIds.size;
    if (availableCount < neededPairs) {
      usedIds = new Set();
    }

    const newPokemonIds = getRandomUniqueNumbers(neededPairs, 800, usedIds);

    newPokemonIds.forEach(id => usedIds.add(id));
    sessionStorage.setItem(usedPokemonIdsKey, JSON.stringify(Array.from(usedIds)));

    try {
      const pokemonData = await fetchPokemonData(newPokemonIds);


      pokemonData.forEach(poke => {
        cards.push({ ...poke, matched: false, flipped: false, uniqueCardId: `${poke.id}-1` });
        cards.push({ ...poke, matched: false, flipped: false, uniqueCardId: `${poke.id}-2` });
      });

      cards = shuffleArray(cards);

      pairsLeft = neededPairs;
      gameStatus = 'playing';
      updateStatus();
      renderCards();
      powerUpBtn.disabled = false;


      timerInterval = setInterval(() => {
        timer--;
        updateStatus();
        if (timer <= 0) {
          clearInterval(timerInterval);
          gameStatus = 'lost';
          updateStatus();
          showMessage('⏰ Time\'s up! Game over.');
          powerUpBtn.disabled = true;
        }
      }, 1000);
    } catch (err) {
      alert('Error fetching');
      gameStatus = 'notStarted';
      updateStatus();
    }
  }

  function setTheme(themeName) {
    if (themeName === 'dark') {
      body.classList.remove('light');
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
      body.classList.add('light');
    }
  }

  let powerUpActive = false;
  function activatePowerUp() {
    if (powerUpCooldown > 0 || gameStatus !== 'playing') return;

    powerUpActive = true;
    powerUpBtn.disabled = true;
    powerUpBtn.textContent = 'Power-Up (Active)';

    cards.forEach(card => card.flipped = true);
    renderCards();

    setTimeout(() => {

      cards.forEach(card => {
        if (!card.matched) card.flipped = false;
      });
      renderCards();
      powerUpActive = false;

      powerUpCooldown = 30;
      powerUpBtn.textContent = `Power-Up (${powerUpCooldown}s)`;
      powerUpCooldownInterval = setInterval(() => {
        powerUpCooldown--;
        if (powerUpCooldown <= 0) {
          clearInterval(powerUpCooldownInterval);
          powerUpBtn.textContent = 'Power-Up';
          if (gameStatus === 'playing') powerUpBtn.disabled = false;
        } else {
          powerUpBtn.textContent = `Power-Up (${powerUpCooldown}s)`;
        }
      }, 1000);
    }, 5000);
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  powerUpBtn.addEventListener('click', activatePowerUp);
  themeSelect.addEventListener('change', () => {
    theme = themeSelect.value;
    setTheme(theme);
  });

  setTheme(theme);
}

$(document).ready(setup)