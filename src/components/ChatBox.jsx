import { useEffect, useRef, useState } from "react";
import { useChatContext } from "../context/ChatProvider";
import styles from "./ChatBox.module.css";
import ChatBoxProfileModal from "./ChatBoxProfileModal";
import { Spinner, useToast } from "@chakra-ui/react";

import Axios from "axios";
// import io from "socket.io-client";
import ScrollableChat from "./ScrollableChat";
import TypingIndicator from "./miscellaneous/TypingIndicator";
import UploadBox from "./miscellaneous/UploadBox";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// const ENDPOINT = "http://localhost:5000";
// let socket;
// let selectedChatCompare = {};

function ChatBox() {
  const {
    user,
    selectedChat,
    setSelectedChat,
    chats,
    setChats,
    fetchChatsAgain,
    setFetchChatsAgain,
    notification,
    setNotification,
    notificationFromBackend,
    setNotificationFromBackend,
    socket,
    onlineUsers,
    refetchMessages,
    setRefetchMessages,
  } = useChatContext();

  let loggedUser =
    Object.keys(user || {}).length === 0
      ? JSON.parse(localStorage.getItem("userInfo"))
      : user;

  // let fetchedMessages = JSON.parse(localStorage.getItem("messages"));

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [lodingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const toast = useToast();

  //Derived state
  const isChatSelected = Object.keys(selectedChat || {}).length;

  console.log("ChatBox component");
  console.log({ messages });
  console.log({ chats });
  console.log({ socketConnected });
  console.log({ notification });

  const chatContainerRef = useRef(null);
  const prevChatIdRef = useRef(null);

  //func. to handle offline user's notifications
  async function handleNotificationsForOfflineUsers(
    onlineUsersArr,
    messObj,
    loggedInUser
  ) {
    let otherUserId =
      loggedInUser?.id === messObj.chat.users[0]?.id
        ? messObj.chat.users[1].id
        : messObj.chat.users[0].id;

    let userOnline = onlineUsersArr.includes(otherUserId.toString());

    if (!userOnline) {
      //Logic for creating a Notification document.
      try {
        const { data } = Axios.post(
          `${API_BASE_URL}/api/notification/create`,
          { messageId: messObj.id, userId: otherUserId },
          { withCredentials: true }
        );

        console.log({ notificationCreated: data });
      } catch (err) {
        console.log(err.message);
      }
    }
  }

  async function fetchMessages() {
    if (!selectedChat?.id) return;

    console.log("fetcheMessages func.");
    try {
      setLoadingMessages(true);
      const { data } = await Axios.get(
        `${API_BASE_URL}/api/message/chat/${selectedChat.id}`,
        { withCredentials: true }
      );
      console.log({ fetchedMessages: data });
      setMessages(data);
      localStorage.setItem("messages", JSON.stringify(data));

      //    socket.emit("join chat", selectedChat);

      // 👇 STOMP publish to join room
      socket.publish({
        destination: "/app/chat/join",
        body: JSON.stringify(selectedChat),
      });

      if (prevChatIdRef.current != selectedChat?.id) {
        prevChatIdRef.current = selectedChat.id;
      }
    } catch (err) {
      console.log(err.message);
      toast({
        title: "Error Occured !!",
        description: `Failed to load the Messages (Server Issue)`,
        status: "error",
        duration: "4000",
        isClosable: true,
        position: "top",
      });
    } finally {
      setLoadingMessages(false);
    }
  }

  /*
  useEffect(() => {
    // socket = io(ENDPOINT);
    socket.emit("setup", user);
    socket.on("connected", () => {
      setSocketConnected(true);
    });

    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));
    socket.on("refetchingMessages", () => setRefetchMessages(!refetchMessages));
  }, []);
 */

  useEffect(() => {
    fetchMessages();
    // selectedChatCompare = selectedChat;

    return () => {
      // Leave the room when the component unmounts
      if (socket && socket.connected && selectedChat?.id) {
        const roomDTO = {
          roomId: selectedChat.id,
        };

        socket.publish({
          destination: "/app/chat/leave",
          body: JSON.stringify(roomDTO),
        });
      }
    };
  }, [selectedChat?.id, refetchMessages, socket]);

  useEffect(() => {
    const isSocketReady = socket && socket.active && socket.connected;

    console.log("useEffect-ChatBox-1");
    if (!isSocketReady || !user?.id) return;

    // ✅ Send the "setup" payload to backend
    socket.publish({
      destination: "/app/chat/setup", // destination matches @MessageMapping
      body: JSON.stringify(user), // must match @Payload type
    });
  }, [socket]);

  useEffect(() => {
    const isSocketReady = socket && socket.active && socket.connected;

    console.log("useEffect-ChatBox-2");
    if (!isSocketReady || !user?.id) return;

    const refetchMessagesSubscription = socket.subscribe(
      "/user/queue/refetchMessages",
      () => {
        setRefetchMessages((prev) => !prev);
      }
    );

    // ✅ Subscribe to typing indicators (if needed globally)
    const typingSubscription = socket.subscribe(
      `/topic/${selectedChat?.id}/typing`,
      (message) => {
        const typingUserId = message.body;

        console.log("/topic/typing");
        console.log({ typingUserId });

        if (typingUserId && typingUserId !== user.id.toString()) {
          setIsTyping(true);
        }
      }
    );

    const stopTypingSubscription = socket.subscribe(
      `/topic/${selectedChat?.id}/stopTyping`,
      (message) => {
        const typingUserId = message.body;

        console.log("/topic/typing");
        console.log({ typingUserId });

        if (typingUserId && typingUserId !== user.id.toString()) {
          setIsTyping(false);
        }
      }
    );

    // ✅ Set connection state
    setSocketConnected(true);

    // ✅ Cleanup subscriptions on unmount
    return () => {
      refetchMessagesSubscription.unsubscribe();
      typingSubscription.unsubscribe();
      stopTypingSubscription.unsubscribe();
    };
  }, [socket, selectedChat?.id]);

  // useEffect(() => {
  //   fetchMessages();

  //   // selectedChatCompare = selectedChat;

  //   return () => {
  //       // Only leave if the chat ID actually changed (not due to refetchMessages)
  //       if (prevChatIdRef.current !== selectedChat.id) {
  //         socket.publish({
  //           destination: "/app/chat/leave",
  //           body: JSON.stringify({ roomId: selectedChat.id }),
  //         });
  //       }
  //   };
  // }, [selectedChat?._id, refetchMessages]);

  // useEffect(() => {
  //   console.log("message received useEffect");

  //   socket.on("message received", (newMessageReceived) => {
  //     console.log("socket: messageReceived event triggered");

  //     if (
  //       !Object.keys(selectedChat || {}).length ||
  //       selectedChat?._id !== newMessageReceived?.chat?._id
  //     ) {
  //
  //       1] Logic to notify the logged in user, that incoming message is from other user(name) & that
  //          message is belonging to some other chat obj/doc.
  //       2] If selectedChat is an empty object, that means none of the chat obj. is selected by the logged
  //          in user, so push all the incoming messages coming from other users & belonging to
  //          various diffn. chat objs., into notification.
  //

  //       console.log({ newMessageReceived });
  //       console.log({ selectedChat });
  //       console.log("Notification section");

  //       if (!notification.includes(newMessageReceived)) {
  //         setNotification([newMessageReceived, ...notification]);
  //         setFetchChatsAgain(!fetchChatsAgain);
  //       }

  //     } else {
  //       setMessages([...messages, newMessageReceived]);
  //       setFetchChatsAgain(!fetchChatsAgain);
  //       localStorage.setItem(
  //         "messages",
  //         JSON.stringify([...messages, newMessageReceived])
  //       );
  //     }
  //   });

  //   return () => {
  //     // Clean up the socket event listener, when the component unmounts or the effect re-runs
  //     socket.off("message received");
  //   };
  // }, [selectedChat, socket, messages.length]);

  useEffect(() => {
    const isSocketReady = socket && socket.active && socket.connected;

    console.log("useEffect-ChatBox-3");

    if (!isSocketReady || !user?.id) return;

    console.log("Subscribing to personal /queue/messages");

    const subscription = socket.subscribe(
      "/user/queue/messages",
      (messageFrame) => {
        const newMessageReceived = JSON.parse(messageFrame.body);
        console.log("STOMP: message received", newMessageReceived);

        if (
          !selectedChat?.id ||
          selectedChat.id !== newMessageReceived.chat.id
        ) {
          // Incoming message is for a different chat
          console.log("Notification section");

          /*
             
            const alreadyInNotification = notification.some(
              (msg) => msg.id === newMessageReceived.id
             );

             if (!alreadyInNotification) {        
              
             }

          */

          setNotification((prev) => [newMessageReceived, ...prev]);
          setFetchChatsAgain((prev) => !prev);
        } else {
          // Incoming message belongs to the selected chat

          console.log("Incoming message belongs to the selected chat !!!");

          setMessages((prev) => [...prev, newMessageReceived]);
          setFetchChatsAgain((prev) => !prev);
          localStorage.setItem(
            "messages",
            JSON.stringify([...messages, newMessageReceived])
          );
        }
      }
    );

    return () => {
      console.log("Unsubscribing from /user/queue/messages");
      subscription.unsubscribe(); // Clean up
    };
  }, [socket, selectedChat?.id, messages.length, notification?.length]);

  //Logic to scroll at the very bottom of the chatArea 'div' (scroll-behavior: smooth; /* Enables smooth scrolling */)
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 5) {
      // Scroll to the bottom of the chat container
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages.length]); // Depend on messages to re-scroll when a new message arrives

  // This useEffect Hook will handle the scenario, where when you click on a particular chat, the
  // notifications associated with them will be removed as you are seeing those messages in person
  useEffect(() => {
    async function handleNotificationForSelectedChat() {
      if (!notification?.length || !selectedChat?.id) return;

      // Local copies to work with
      const updatedBackendNotifications = [...notificationFromBackend];
      const updatedNotifications = [...notification];

      for (const nt of notification) {
        if (nt.chat.id === selectedChat.id) {
          const isPresent = updatedBackendNotifications.find(
            (el) => el.currMessage.id === nt.id
          );

          if (isPresent) {
            console.log("Notification deleted from backend !!!");

            try {
              const { data } = await Axios.delete(
                `${API_BASE_URL}/api/notification/notificationdelete`,
                {
                  headers: { "Content-Type": "application/json" },
                  data: { notifyId: isPresent.id },
                  withCredentials: true,
                }
              );

              console.log({ deletedNotificationDoc: data });

              // Remove from local arrays
              const indexBackend = updatedBackendNotifications.findIndex(
                (el) => el.currMessage.id === nt.id
              );
              if (indexBackend !== -1)
                updatedBackendNotifications.splice(indexBackend, 1);

              const indexNotification = updatedNotifications.findIndex(
                (el) => el.id === nt.id
              );
              if (indexNotification !== -1)
                updatedNotifications.splice(indexNotification, 1);
            } catch (err) {
              console.log(err.message);
            }
          }
        }
      }

      // Set updated state once
      setNotificationFromBackend(updatedBackendNotifications);
      setNotification(updatedNotifications);
    }

    handleNotificationForSelectedChat();
  }, [selectedChat?.id, notification?.length]);

  async function sendMessage(e) {
    const isEnterKey = e?.key === "Enter";
    const isClick = e?.type === "click";

    if (!isEnterKey && !isClick) return; // Do nothing unless it's Enter key or click
    if (!newMessage.trim()) {
      toast({
        title: "Error Occured !!",
        description: `Please enter some message !!!`,
        status: "warn",
        duration: "4000",
        isClosable: true,
        position: "top",
      });
      return;
    }

    console.log("Sending message...");

    console.log("Hit Enter");

    //Sends a 'stop typing' event to the server
    //socket.emit("stop typing", selectedChat._id);

    socket.publish({
      destination: "/app/chat/stopTyping",
      body: selectedChat.id,
    });

    setNewMessage("");
    try {
      setSendingMessage(true);
      const { data } = await Axios.post(
        `${API_BASE_URL}/api/message/send`,
        {
          content: newMessage,
          chatId: selectedChat.id,
        },
        { withCredentials: true }
      );

      console.log({ newMessageDoc: data.message });
      console.log({ updatedChatDoc: data.updatedChat });

      setMessages([...messages, data.message]);
      localStorage.setItem(
        "messages",
        JSON.stringify([...messages, data.message])
      );

      setChats((chats) =>
        chats.map((el) =>
          el.id === data.updatedChat.id ? data.updatedChat : el
        )
      );

      //Sends a 'new message' event from client to the server, with payload(data).
      //socket.emit("new message", data.message);

      socket.publish({
        destination: "/app/chat/send",
        body: JSON.stringify(data.message), // `data.message` is your `MessageDTOFE` object
      });

      // selectedChatCompare = data.updatedChat;

      handleNotificationsForOfflineUsers(
        onlineUsers,
        data.message,
        user || loggedUser
      );

      toast({
        title: "Message sent Successfully !!",
        status: "success",
        duration: "4000",
        isClosable: true,
        position: "top",
      });
    } catch (err) {
      console.log(err.message);
      toast({
        title: "Error Occured !!",
        description: `Unable to send the Message (Server Issue)`,
        status: "error",
        duration: "4000",
        isClosable: true,
        position: "top",
      });
    } finally {
      setSendingMessage(false);
    }
  }

  function typingHandler(e) {
    setNewMessage(e.target.value);

    //Typing Indicator Logic
    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      // socket.emit("typing", selectedChat._id);

      socket.publish({
        destination: "/app/chat/typing",
        body: selectedChat.id,
      });
    }

    // let lastTypingTime = new Date().getTime();
    // let timerLength = 3000;

    // setTimeout(() => {
    // let timeNow = new Date().getTime();
    // let timeDiff = timeNow - lastTypingTime;

    // if (timeDiff >= timerLength && typing) {
    //   socket.emit("stop typing", selectedChat._id);
    //   setTyping(false);
    // }
    // }, timerLength);

    /* Another method */
    let delay = 3000; //3s
    let timeoutId;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // socket.emit("stop typing", selectedChat._id);

      socket.publish({
        destination: "/app/chat/stopTyping",
        body: selectedChat.id,
      });

      setTyping(false);
    }, delay);
  }

  const getChatName = (loggedUser, users) => {
    // console.log(loggedUser);
    // console.log(users);
    // console.log(loggedUser._id === users[0]._id);
    // console.log(users[1].name);
    return loggedUser.id === users[0].id ? users[1].name : users[0].name;
  };

  return (
    <>
      {isChatSelected ? (
        <div className={styles.container}>
          <div className={styles.header}>
            {!selectedChat.groupChat
              ? getChatName(user || loggedUser, selectedChat.users)
              : selectedChat.chatName}
            <div style={{ display: "flex", gap: "10px" }}>
              {selectedChat.groupChat && (
                <button
                  className={styles.iconButton}
                  onClick={() => setShowProfileModal(true)}
                >
                  <span className={styles.eyeIcon}>
                    <i className={`fas fa-eye ${styles.eyeIcon}`}></i>
                  </span>
                </button>
              )}
              <button
                className={styles.iconButton}
                onClick={() => setSelectedChat({})}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </button>
            </div>
          </div>
          <div ref={chatContainerRef} className={styles.chatArea}>
            {/* Chat messages will go here */}
            {lodingMessages ? (
              <Spinner
                size="xl"
                w={20}
                h={20}
                alignSelf="center"
                margin="auto"
              />
            ) : (
              <div className={styles.messagesContainer}>
                {/* Display Messages */}
                <ScrollableChat
                  messages={messages}
                  OnSetMessages={setMessages}
                />
              </div>
            )}
            <div onKeyDown={sendMessage} className={styles.inputContainerF}>
              {isTyping ? <TypingIndicator /> : <></>}
              <input
                type="text"
                placeholder="Enter the Message"
                className={styles.inputField}
                onChange={typingHandler}
                value={newMessage}
              />
              {sendingMessage ? (
                <Spinner
                  size="sm"
                  thickness="3px"
                  speed="0.45s"
                  color="#63E6BE"
                  emptyColor="gray.200"
                  position="absolute"
                  className={styles.spinnerMessage}
                />
              ) : (
                <button
                  className={styles.UploadBtn}
                  onClick={() => setShowUploadBox(!showUploadBox)}
                >
                  <i
                    className="fa-solid fa-paperclip"
                    style={{ color: "#63E6BE" }}
                  ></i>
                </button>
              )}
              <button className={styles.sendBtn} onClick={sendMessage}>
                <i
                  className="fa-solid fa-paper-plane"
                  style={{ color: "#63E6BE" }}
                ></i>
              </button>
              {showUploadBox && (
                <UploadBox
                  onCloseBox={setShowUploadBox}
                  messages={messages}
                  onSetMessages={setMessages}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.BlankContainer}>
          <p>Click on a user to start chatting</p>
        </div>
      )}

      {showProfileModal && (
        <ChatBoxProfileModal onClose={setShowProfileModal} />
      )}
    </>
  );
}

export default ChatBox;
