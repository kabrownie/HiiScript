"use strict";

(function(){
  let activeModal = null;
  let returnFocus = null;

  function announce(message){
    const live = document.querySelector("#status");
    if(live) live.setAttribute("aria-live", "polite");
    if(message && live) live.textContent = message;
  }

  function focusable(root){
    return Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null);
  }

  function openModal(modal, opener){
    if(!modal) return;
    activeModal = modal;
    returnFocus = opener || document.activeElement;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const first = focusable(modal)[0];
    if(first) first.focus();
  }

  function closeModal(modal){
    if(!modal) return;
    modal.classList.remove("open");
    if(activeModal === modal){
      activeModal = null;
      if(returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
      returnFocus = null;
    }
  }

  document.addEventListener("click", event => {
    const opener = event.target.closest("[data-modal-target]");
    if(opener){
      const modal = document.querySelector(opener.dataset.modalTarget);
      if(modal) openModal(modal, opener);
    }
  });

  document.addEventListener("keydown", event => {
    if(event.key !== "Escape") return;
    const library = document.querySelector("#libraryModal");
    if(library && library.classList.contains("open")){
      closeModal(library);
      announce("Library closed");
    }
  });

  document.addEventListener("keydown", event => {
    if(!activeModal || !activeModal.classList.contains("open")) return;
    if(event.key !== "Tab") return;
    const items = focusable(activeModal);
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  });

  window.ScreenplayAccessibility = { announce, openModal, closeModal };
})();
