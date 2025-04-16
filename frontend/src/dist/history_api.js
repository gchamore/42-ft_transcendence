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
    return __awaiter(this, void 0, void 0, function* () {
        yield verify_token();
        if (event.state && event.state.section)
            set_new_section_index(event.state.section);
        else
            set_new_section_index("home");
        update_sections();
    });
});
document.addEventListener("DOMContentLoaded", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(window.location.pathname);
    yield verify_token();
    set_new_section_index(window.location.pathname.replace("/", ""));
    update_sections();
    history.replaceState({ section: sections[section_index].type }, "", sections[section_index].type);
}));
/* --------- */
