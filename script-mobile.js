
// Mobile-specific script overrides

if (window.matchMedia("(max-width: 600px)").matches) {

  // Override randomPosition to keep cards within the container
  function randomPosition(card) {
    const containerRect = container.getBoundingClientRect();
    card.style.position = 'absolute';
    card.style.left = (Math.random() * (containerRect.width - card.offsetWidth)) + "px";
    card.style.top = (Math.random() * (containerRect.height - card.offsetHeight)) + "px";
  }

  // Override alignAllCardsGrid for mobile
  function alignAllCardsGrid(cardsArr) {
    const allCards = cardsArr || Array.from(document.querySelectorAll('.card'));
    const containerRect = container.getBoundingClientRect();
    const cols = 5; // More columns for mobile
    const cardW = parseFloat(getComputedStyle(allCards[0]).width);
    const cardH = parseFloat(getComputedStyle(allCards[0]).height);
    const gapX = (containerRect.width - cols * cardW) / (cols + 1);
    const rows = Math.ceil(allCards.length / cols);
    const gapY = (containerRect.height - rows * cardH) / (rows + 1);

    if (!cardsArr) {
      alignGridOrder = allCards.slice();
    } else {
      alignGridOrder = cardsArr.slice();
    }
    allCards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const left = gapX + col * (cardW + gapX);
      const top = gapY + row * (cardH + gapY);
      card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.style.zIndex = 1000 + i;
      setTimeout(() => { card.style.transition = ''; }, 600);
    });
  }

  // Override other functions with hardcoded positions as needed
  // For example, the buttons created in showShinkeisuijakuButtons and showNextButtons
  // could be appended to a different, more mobile-friendly container.

}
