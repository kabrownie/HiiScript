"use strict";

(function(){
  function announce(message){
    const live = document.querySelector("#status");
    if(live) live.setAttribute("aria-live", "polite");
    if(message && live) live.textContent = message;
  }

  document.addEventListener("keydown", event => {
    if(event.key !== "Escape") return;
    const library = document.querySelector("#libraryModal");
    if(library && library.classList.contains("open")){
      library.classList.remove("open");
      announce("Library closed");
    }
  });

  window.ScreenplayAccessibility = { announce };
})();
