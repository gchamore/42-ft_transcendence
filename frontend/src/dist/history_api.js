"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/* Event listeners */
window.addEventListener("popstate", function (event) {
    console.log("popstate");
});
document.addEventListener("DOMContentLoaded", () => __awaiter(void 0, void 0, void 0, function* () {
    sections.forEach(element => { element.switch_logged_off(); });
    user = yield verify_token();
    section_index = get_section_index(window.location.pathname.replace("/", ""));
    if (section_index !== HOME_INDEX)
        select_section(section_index);
    history.pushState({}, "", sections[section_index].type);
}));
/* --------- */
