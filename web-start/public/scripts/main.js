/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
//처음에 uid가 없기때문에 한번 방을 로드해야해서 필요한 플래그
//GLOBAL VARIABLE
let G_CHECK_ROOM_FLAG = false;
let G_ROOMUID = null;
// 방 리스트를 나타내고, li 태그 string으로 이루어져 있는 배열
let arrRoomListHtml = [];
let liRoomId = null; 

// click event
$(document).ready(function(){
    roomCreateButtonElement.addEventListener('click', function(){
        if(!isUserSignedIn()){
            alert("먼저 로그인 하세요");
            return;
        }
        let inputRoom = $("#inputRoom").val();
        if( inputRoom == ""){
            alert("방이름을 입력하세요");
            return;
        }
        createRoom(inputRoom);
    });
    roomSearchButtonElement.addEventListener('click', function(){
        if(!isUserSignedIn()){
            alert("먼저 로그인 하세요");
            return;
        }
        $("#roomTitleContainer").css('display', 'none');
        $("#roomListContainer").css('display', 'block');
    });
    $(".mdl-layout__header").click(function(){
        $("#roomTitleContainer").css('display', 'block');
        $("#roomListContainer").css('display', 'none');
        $("#messages-card-container").css('display','none');
        $("#messages").empty();
    });
    // 페이지가 로드 해오면서 진행이 되기때문에 수정하였음.
    $(document).on("click",".liRoomList", function(){
        $("#roomListContainer").css('display', 'none');
        $("#roomTitleContainer").css('display', 'none');
        $("#messages-card-container").css('display','block');
        let liRoomIndex = $(".liRoomList").index(this);
        liRoomId = $(".liRoomList")[liRoomIndex].id;
        loadMessages(liRoomId);
    });
});
// Signs-in Friendly Chat.
function signIn() {
    let provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
}

// Signs-out of Friendly Chat.
function signOut() {
    firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
    firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
    return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
    return firebase.auth().currentUser.displayName;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
    return !!firebase.auth().currentUser;
}

// Saves a new message on the Firebase DB.
function saveMessage(messageText) {
  return firebase.firestore()
         .collection('rooms')
         .doc(firebase.auth().currentUser.uid)
         .collection('roomNum')
         .doc(liRoomId)
         .collection('messages').add({
    name: getUserName(),
    text: messageText,
    profilePicUrl: getProfilePicUrl(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
}

// Loads chat messages history and listens for upcoming ones.
// ************
function loadMessages(id) {
  /*  var query = firebase.firestore()
                  .collection('messages')
                  .orderBy('timestamp', 'desc')
                  .limit(12);

  // Start listening to the query.
  query.onSnapshot(function(snapshot) {
    snapshot.docChanges().forEach(function(change) {
      if (change.type === 'removed') {
        deleteMessage(change.doc.id);
      } else {
        var message = change.doc.data();
        displayMessage(change.doc.id, message.timestamp, message.name,
                       message.text, message.profilePicUrl, message.imageUrl);
      }
    });
  });*/
    let query = firebase.firestore()
                .collection('rooms')
                .doc(firebase.auth().currentUser.uid)
                .collection('roomNum')
                .doc(id)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(12);

    query.onSnapshot(function(snapshot){
        snapshot.docChanges().forEach(function(change){
            if(change.type == 'removed') {
                deleteMessage(change.doc.id);
            } else {
                let message = change.doc.data();
                displayMessage(change.doc.id, message.timestamp, message.name,
                                message.text, message.profilePicUrl, message.imageUrl);
                console.log(message);
              }
        });
    });
}

// Saves a new message containing an image in Firebase.
// This first saves the image in Firebase storage.
function saveImageMessage(file) {
  // 1 - We add a message with a loading icon that will get updated with the shared image.
  firebase.firestore().collection('messages').add({
    name: getUserName(),
    imageUrl: LOADING_IMAGE_URL,
    profilePicUrl: getProfilePicUrl(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(messageRef) {
    // 2 - Upload the image to Cloud Storage.
    var filePath = firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name;
    return firebase.storage().ref(filePath).put(file).then(function(fileSnapshot) {
      // 3 - Generate a public URL for the file.
      return fileSnapshot.ref.getDownloadURL().then((url) => {
        // 4 - Update the chat message placeholder with the image's URL.
        return messageRef.update({
          imageUrl: url,
          storageUri: fileSnapshot.metadata.fullPath
        });
      });
    });
  }).catch(function(error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  });
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
    firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.firestore().collection('fcmTokens').doc(currentToken)
          .set({uid: firebase.auth().currentUser.uid});
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
    console.log('Requesting notifications permission...');
    firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
        saveMessagingDeviceToken();
    }).catch(function(error) {
        console.error('Unable to get permission to notify.', error);
    });
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveMessage(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');

    // We save the Firebase Messaging Device token and enable notifications.
    saveMessagingDeviceToken();
    checkAndSaveUser(user);
    checkRooms();
  } else { // User is signed out!
    arrRoomListHtml = [];
    // Hide user's profile and sign-out button.
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
  }
}


/**
* 신규 User를 IndexedDB에서 체크 후 저장
*/
function checkAndSaveUser(user){
    let userUid = user.uid;
    let data = {
        email : user.email,
        userName: user.displayName, 
        profileImg : user.photoURL ? user.photoURL : ''
    };

    // 위의 data json 형식으로 users collection 생성
    let setDoc = firebase.firestore().collection('Users').doc(userUid).set(data);
}

/*
* 유저가 채팅방을 생성할 때
*/
function createRoom(inputRoom){
    $("#roomListContainer").css('display', 'block');
    $("#roomTitleContainer").css('display', 'none');
    let currUserUid = firebase.auth().currentUser.uid;
    let getNewUid  = firebase.firestore().collection('rooms').doc(currUserUid).collection('roomNum').doc().id;
    let roomData = {
        roomUid : getNewUid, 
        roomName : inputRoom,
        timeStamp : firebase.firestore.FieldValue.serverTimestamp(),
        userList : [
            currUserUid
        ],
        userCount : 1 
    }
    G_ROOMUID = getNewUid; 

    // Add a new document with a generated id.
    let messageRef = firebase.firestore().collection('rooms').doc(currUserUid).collection('roomNum').add(roomData);
}

// 채팅방 실시간 확인할 수 있도록 snapshot 적용
function checkRooms() {
    if(isUserSignedIn()){
        let liRoomTemplate = "";
        let liStyle = "style = "+"'list-style : none;'"; 
        let removeBool = false;
        let doc = firebase.firestore().collection('rooms').doc(firebase.auth().currentUser.uid).collection('roomNum');
        doc.onSnapshot(function(snapshot) {
            snapshot.docChanges().forEach(function(change){
                if(change.type === 'removed'){
                    console.log("Remove Room");            
                    removeBool = true;
                    deleteMessage(change.doc.data().roomName);

                }
                else{
                    removeBool = false;
                    console.log('New Room: ', change.doc.data());
                    liRoomTemplate = "<li class='liRoomList' id='" + change.doc.data().roomName  + "'"+liStyle+">" + getUserName()+"_"+change.doc.data().roomName  +"<span></span></li>";
                    arrRoomListHtml.push(liRoomTemplate);
                }
            });
            if(!removeBool){
                displayRooms(arrRoomListHtml);
            }
        });
    }
    else{
        console.log("check room fail");
        return false;
    }
}

// 방 리스트가 있는 배열을 join하여 방 리스트 화면 생성
function displayRooms(displayData){
    let displayHtml = displayData.reverse().join('');
    $("#ulroomList").html(displayHtml);
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
  if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
    return url + '?sz=150';
  }
  return url;
}

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Delete a Message from the UI.
function deleteMessage(id) {
  var div = document.getElementById(id);
  // If an element for that message exists we delete it.
  if (div) {
    div.parentNode.removeChild(div);
  }
}

function createAndInsertMessage(id, timestamp) {
  const container = document.createElement('div');
  container.innerHTML = MESSAGE_TEMPLATE;
  const div = container.firstChild;
  div.setAttribute('id', id);

  // If timestamp is null, assume we've gotten a brand new message.
  // https://stackoverflow.com/a/47781432/4816918
  timestamp = timestamp ? timestamp.toMillis() : Date.now();
  div.setAttribute('timestamp', timestamp);

  // figure out where to insert new message
  const existingMessages = messageListElement.children;
  if (existingMessages.length === 0) {
    messageListElement.appendChild(div);
  } else {
    let messageListNode = existingMessages[0];

    while (messageListNode) {
      const messageListNodeTime = messageListNode.getAttribute('timestamp');

      if (!messageListNodeTime) {
        throw new Error(
          `Child ${messageListNode.id} has no 'timestamp' attribute`
        );
      }

      if (messageListNodeTime > timestamp) {
        break;
      }

      messageListNode = messageListNode.nextSibling;
    }

    messageListElement.insertBefore(div, messageListNode);
  }

  return div;
}

// Displays a Message in the UI.
function displayMessage(id, timestamp, name, text, picUrl, imageUrl) {
  var div = document.getElementById(id) || createAndInsertMessage(id, timestamp);

  // profile picture
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(picUrl) + ')';
  }

  div.querySelector('.name').textContent = name;
  var messageElement = div.querySelector('.message');

  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUrl) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    });
    image.src = imageUrl + '&' + new Date().getTime();
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  // Show the card fading-in and scroll to view the new message.
  setTimeout(function() {div.classList.add('visible')}, 1);
  messageListElement.scrollTop = messageListElement.scrollHeight;
  messageInputElement.focus();
}

// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
  if (messageInputElement.value) {
    submitButtonElement.removeAttribute('disabled');
  } else {
    submitButtonElement.setAttribute('disabled', 'true');
  }
}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}
// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var messageCardElement = document.getElementById('messages-card');
var roomCreateButtonElement = document.getElementById('roomCreateBtn');
var roomSearchButtonElement = document.getElementById('roomSearchBtn');
// 맨처음 메시지 카드 엘리먼트
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var imageFormElement = document.getElementById('image-form');
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');


// Saves message on form submit.
messageFormElement.addEventListener('submit', onMessageFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload.
imageButtonElement.addEventListener('click', function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

// TODO: Enable Firebase Performance Monitoring.

// We load currently existing chat messages and listen to new ones.
//loadMessages();
//checkRooms();
