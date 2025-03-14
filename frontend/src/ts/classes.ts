// /* User */
// class User {
//     name: string;
//     avatar_path: string

//     constructor(name:string) {
//         this.name = name;
//         this.avatar_path = "assets/avatar.png";
//     }
// }
// /* --------- */



// /* Sections */
// abstract class ISection {
//     abstract type: string;
//     abstract is_protected: boolean;

//     abstract leave(): boolean; // False is failure (go to /failure otherwise)
//     abstract arrive(): boolean;
// }

// class Home extends ISection {
//     type = "home";
//     is_protected = false;

//     leave() {
//         console.log(`Leaving ${this.type}`)
//     }
// }

// class Profile extends ISection {
//     type = "profile";
//     is_protected = false;
    
//     leave() {
        
//     }
// }

// class Friends extends ISection {
//     type = "friends";
//     is_protected = true;
    
//     leave() {
        
//     }
// }

// class MyError extends ISection {
//     type = "error";
//     is_protected = false;

//     leave() { return true; }
//     arrive() {

//         return true;
//     }
// }
// /* --------- */
