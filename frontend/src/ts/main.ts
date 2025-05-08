import { go_section } from "./sections.js";

// Initialize the profile button
document.addEventListener("DOMContentLoaded", () => {
  const profileBtn = document.getElementById("profile-btn");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => go_section("profile", ''));
  }
});