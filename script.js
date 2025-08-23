let recipes = [];
let dictionary
let isAdminSession = false;

const firebaseConfig = {
  apiKey: "AIzaSyAhoJe-sERK2rvhrZx1T5uJvw7dyq38U0A",
  authDomain: "recipe-book-eca9e.firebaseapp.com",
  projectId: "recipe-book-eca9e",
  storageBucket: "recipe-book-eca9e.appspot.com", 
  messagingSenderId: "919076495627",
  appId: "1:919076495627:web:323e76aabce76f350dc20e",
  measurementId: "G-8Y6CC5PPV9"
};

import {initializeApp} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {getAuth, signInWithEmailAndPassword, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

setLogLevel("silent"); 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function loadDictionary(){
  const aff = await fetch("dictionaries/en_US.aff").then(w=>w.text());
  const dic = await fetch("dictionaries/en_US.dic").then(w=>w.text());
  dictionary = new Typo("en_US", aff, dic, {platform: true});
};
loadDictionary();

function correctSentence(sentence){
  if (!dictionary) return sentence;
  return sentence.split(" ").map(word=>{
    if (!dictionary.check(word)){
      const suggestions = dictionary.suggest(word);
      return suggestions.length > 0 ? suggestions[0] : word;
    }
    return word;
  }).join(" ")
};

async function loadRecipesfromDB(){
  try {
    recipes = [];
    const snap = await getDocs(collection(db, "recipes"));
    snap.forEach(docs => {
      recipes.push({ id: docs.id, ...docs.data() });
    });
    renderRecipes(recipes);
  } catch (err) {
    console.error("Failed to load recipes:", err);
    alert("Failed to connect to Firestore. Check console for details.");
  }
}
 
async function saveRecipesfromDB(recipe){
  try {
    await addDoc(collection(db, "recipes"), recipe);
    await loadRecipesfromDB();
  } catch (err) {
    console.error("Failed to save recipe:", err);
    alert("Could not save recipe to Firestore. Check console for details.");
  }
}

async function deleteRecipefromDB(id){
  await deleteDoc(doc(db, "recipes", id));
  await loadRecipesfromDB();
}

async function uploadImageToCloudinary(file){
  const URL="https://api.cloudinary.com/v1_1/dndmaxbl2/upload";
  const UPLOAD_PRESET = "recipe_upload";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "recipes");

  const res = await fetch(URL, {
    method: "POST",
    body: formData
  });

  if(!res.ok){
    throw new Error("Image upload failed")
  }

  const data = await res.json();
  console.log("Uploaded Image URL:", data.secure_url);
  return data.secure_url;
}

document.getElementById("recipeForm").addEventListener("submit", async function(e){
  e.preventDefault();

  let name = document.getElementById("name").value.trim();

  let ingredients = document.getElementById("ingredients").value
      .split("\n")
      .map(i=>i.trim())
      .filter(Boolean);

  let steps = document.getElementById("steps").value
      .split("\n")
      .map(s=>s.trim())
      .filter(Boolean);

  const file = document.getElementById("image").files[0];

  if (!name || ingredients.length === 0 || steps.length === 0 || !file) {
    alert("Please fill all fields properly");
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Please upload a valid image file");
    return;
  }

  document.getElementById("recipeForm").reset();

  name = correctSentence(name);
  ingredients = ingredients.map(i=>correctSentence(i));
  steps = steps.map(s=>correctSentence(s));

  try {
    const imageURL = await uploadImageToCloudinary(file);

    const newRecipe = {
      name,
      ingredients,
      steps,
      image: imageURL
    };
    
    console.log("Recipe being saved:", newRecipe);  

    await saveRecipesfromDB(newRecipe);
    alert("Recipe added successfully!")
  } catch (error) {
      console.error("Image upload failed:", error);
  }
});

function renderRecipes(list){
  const container = document.getElementById("recipes");
  container.innerHTML="";

  if(list.length === 0){
    const msg = document.createElement("p");
    msg.textContent = "No Recipes found. Add one!";
    container.appendChild(msg)
  }
  
  list.forEach(recipe=>{
    const card = document.createElement("div");
    card.className = "card";
    container.appendChild(card);

    const iconDiv = document.createElement("div");
    iconDiv.className = "iconDiv";
    card.appendChild(iconDiv);

    const delIcon = document.createElement("i");
    delIcon.className = "fa-solid fa-trash delete-icon";
    delIcon.addEventListener("click", ()=>{deleteRecipe(recipe.id)})
    iconDiv.appendChild(delIcon);

    const img = document.createElement("img");
    img.src = recipe.image;
    img.alt = recipe.name;
    card.appendChild(img);

    const h3 = document.createElement("h3");
    h3.textContent = recipe.name;
    card.appendChild(h3);

    const btn = document.createElement("button");
    btn.addEventListener("click", ()=>viewRecipe(recipe.id));
    btn.textContent = "View Details";
    card.appendChild(btn)
  })
}

function viewRecipe(id){
  const receipe = recipes.find(r=>r.id === id);
  if(!receipe) return;   

  document.getElementById("modalName").textContent = receipe.name;
  document.getElementById("modalImg").src = receipe.image;

  const ingList = document.getElementById("modalIngredients");
  ingList.innerHTML = "";
  receipe.ingredients.forEach((ing)=>{
    const li = document.createElement("li");
    li.textContent = ing;
    ingList.appendChild(li)
  });

  const stepsList = document.getElementById("modalSteps");
  stepsList.innerHTML = ""; 
  receipe.steps.forEach((step)=>{
    const li = document.createElement("li");
    li.textContent = step;
    stepsList.appendChild(li)
  })

  document.getElementById("modal").style.display= "flex";

  document.getElementById("closeModal").addEventListener("click", ()=>{
    document.getElementById("modal").style.display= "none";
  })

  window.addEventListener("click", (e)=>{
    if(e.target.id === "modal"){
      document.getElementById("modal").style.display= "none";
    }
  })
}

const Admin_Email = "sadham070403@gmail.com";

async function requireAdmin(){
  if(isAdminSession) return true;
  const pass = prompt("Enter admin password");
  if(!pass) return false;

  try {
    await signInWithEmailAndPassword(auth, Admin_Email, pass)

    isAdminSession = true;
    return true;
  } catch (error) {
    alert("Wrong password");
    return false;
  }

  onAuthStateChanged(auth, (user)=>{
    if(user && user.email === Admin_Email){
      isAdminSession = true;
    }
    else{
      isAdminSession = false;
    }
    renderRecipes(recipes);
  })
}

async function deleteRecipe(id){
  if(!(await requireAdmin())) return;
  if(!confirm("Are you sure you want to delete this Recipe?")) return;

  await deleteRecipefromDB(id)

  alert("Recipe deleted successfully")
};

function debounce(fn, delay=300){
  let timeout;
  return (...args)=>{
    clearTimeout(timeout);
    timeout = setTimeout(()=>fn(...args), delay)
  }
}

const searchInput = document.getElementById("search");
searchInput.addEventListener("input",debounce(()=>{
  const query = searchInput.value.trim().toLowerCase();

  const filtered = recipes.filter((filt)=>
    filt.name.toLowerCase().includes(query) ||
    filt.ingredients.join(" ").toLowerCase().includes(query)
  );

  renderRecipes(filtered)
}, 250));

loadRecipesfromDB();
