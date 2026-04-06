/*
1] io(ENDPOINT): The 'io()' function is provided by the 'Socket.io' client library, which you include on the 
                 client side. 
 
                 This function initializes the WebSocket connection to the server.
                    |
                    |
                    |--> means that 'io(ENDPOINT)' sets up the real-time communication link between the client 
                         and server. 
   
~ ------------------------------------------------------------------------------------------------------------------                         
                         
2] Here’s what happens step-by-step when you call 'io(ENDPOINT)' on the client: 

   1] Connect to Server: 
      'io(ENDPOINT)' makes an initial connection request to the server at the specified ENDPOINT (e.g., 
       "http://localhost:5000").

   2] Upgrade to WebSocket: 
      Once connected, if both client and server support WebSockets, the connection upgrades from HTTP 
      to a WebSocket. 
      
      This means they can now communicate directly without reopening new HTTP requests.

   3] Event System Enabled: 
      After the connection, 'io()' sets up an event-based system. Both client and server can listen for 
      specific events (e.g., "connect", "message") and emit events to each other.

   4] Real-Time Data Exchange: 
      Once established, the WebSocket connection allows the client and server to send data back and forth
      instantly. This is what makes real-time features, like chat or live notifications, possible.  

~ ----------------------------------------------------------------------------------------------------------------      

 3] When a client (like a web browser) first connects to a server using WebSocket, it starts as a regular HTTP 
    request. 
    
^   Here's how it works step-by-step:

   1. HTTP Connection Initiation: 
      The client begins by making a standard HTTP request to the server, often to a specific route (like, 
      '/socket.io') set up for WebSocket connections.

   2. Upgrade Request: 
      Within this HTTP request, the client includes a special header that says, "I’d like to upgrade this 
      connection to WebSocket." 
    
      This header essentially signals to the server that, instead of closing the connection after the 
      HTTP request-response is complete, it should keep it open and switch to the WebSocket
      protocol.

   3. Server Response: 
      If the server accepts the upgrade request, it sends back a confirmation response, and the connection 
      officially "upgrades" from HTTP to WebSocket.

   4. WebSocket Communication: 
      Now, both the client and server are connected with a WebSocket, allowing them to communicate directly 
      and continuously without needing to start a new HTTP connection each time they want to 
      exchange data.

?  Q. Why Start with HTTP ? 
      The initial HTTP connection helps establish compatibility and security, as many networks already support
      HTTP. 
      
      After upgrading, WebSockets provide a faster, continuous link that’s ideal for real-time communication, 
      as it avoids the repeated back-and-forth of setting up new HTTP requests.     
 
~ ----------------------------------------------------------------------------------------------------------------- 
  I] When the client sends a request with the 'Upgrade: websocket header', it tells the server it wants to 
     switch to WebSocket.

 II] If the server responds with a '101 Switching Protocols' status, the connection is now a WebSocket.

III] From this point forward, both the client and server can send and receive data at any time, maintaining a 
     single connection for continuous real-time communication. 

~ -----------------------------------------------------------------------------------------------------------------
 1] A WebSocket connection is a communication channel that allows real-time, bidirectional data transfer 
   between a client (like a web browser) and a server. 
    
 2] This connection is unique because, unlike traditional HTTP connections, it stays open as long as both 
    sides need it, allowing them to send data back and forth instantly without reopening new connections
    each time.

*  How WebSocket Works:-
  
  I] Initial HTTP Handshake:
     
     1. The client (browser or app) starts by sending an HTTP request to the server, asking to switch to 
        the WebSocket protocol.

     2. If the server supports WebSockets, it responds by agreeing to "upgrade" the connection to WebSocket.

 II] Full-Duplex Connection:

    1. After the handshake, the connection upgrades to a WebSocket, allowing full-duplex communication, 
       meaning both the client and server can send data to each other at any time without waiting for 
       the other to respond first.

    2. This is different from HTTP, where each new request requires a new connection and closes once the 
       server responds.

 III] Data Transmission:

    1. Data is sent in small packets, reducing latency and making the connection fast. WebSocket uses a 
       lightweight protocol, so it's great for scenarios where you need to send frequent updates.

    2. WebSocket communication doesn’t use the standard request/response format of HTTP. Instead, it 
       uses frames that are constantly exchanged, keeping the connection alive.
   


*/

import { createContext, useContext, useEffect, useState } from "react";

import { Client } from "@stomp/stompjs";

// import SockJS from "sockjs-client";

// const ENDPOINT = "http://localhost:8080/ws"; // Spring Boot endpoint

// const ENDPOINT = "wss://scm20.space/ws"; 

const ENDPOINT = "wss://whatsapp-server-t4hn.onrender.com/ws"; // ✅ Native WebSocket URL

const ChatContext = createContext();

function ChatProvider({ children }) {
  const [user, setUser] = useState({});
  const [selectedChat, setSelectedChat] = useState({});
  const [chats, setChats] = useState([]);
  const [notification, setNotification] = useState([]);
  const [notificationFromBackend, setNotificationFromBackend] = useState([]);
  const [fetchChatsAgain, setFetchChatsAgain] = useState(false);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reconnectSocket, setReconnectSocket] = useState(false);
  const [applyBlueTick, setApplyBlueTick] = useState(false);
  const [refetchMessages, setRefetchMessages] = useState(false);
  const [jwtToken, setJwtToken] = useState(null);

  console.log("ChatProvider Context");
  console.log({ user });
  console.log({ selectedChat });
  console.log({ socket });
  console.log({ onlineUsers });

  //   useEffect(() => {
  //     console.log("useEffect-1,Socket connecting");
  //     const currSocket = io(ENDPOINT); // Backend URL
  //     setSocket(currSocket);
  //   }, [reconnectSocket]);

  useEffect(() => {
    const currUser = JSON.parse(localStorage.getItem("userInfo"));
    const tokenVal = JSON.parse(localStorage.getItem("JwtToken"));

    console.log("useEffect-ChatProvider");
    console.log({ currUser, tokenVal });

    if (!currUser?.id || !tokenVal) return;

    setUser(currUser);
    setSelectedChat({});

    const stompClient = new Client({
      brokerURL: ENDPOINT, // ✅ Use native WebSocket (no SockJS)
      connectHeaders: {
        Authorization: `Bearer ${tokenVal}`,
      },
      heartbeatIncoming: 0,  // ✅ Ping server every 10s
      heartbeatOutgoing: 0,  // ✅ Expect server ping every 10s
      reconnectDelay: 5000,
      debug: (str) => console.log(str),
      onConnect: () => {
        console.log("Connected to WebSocket");
        // Save socket client
        setSocket(stompClient);
      },
    });

    stompClient.activate();

    //  return () => {
    //    if (stompClient && stompClient.active) {
    //      stompClient.deactivate();
    //    }
    //  };
  }, []);

  function handleWebSocketConnection(token, currUser) {
    if (!currUser?.id) return;

    const stompClient = new Client({
      brokerURL: ENDPOINT, // ✅ Use native WebSocket (no SockJS)
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 0,  // ✅ Ping server every 10s
      heartbeatOutgoing: 0,  // ✅ Expect server ping every 10s
      reconnectDelay: 5000,
      debug: (str) => console.log(str),
      onConnect: () => {
        console.log("Connected to WebSocket");
        
        // Save socket client
        setSocket(stompClient);
      },
    });

    stompClient.activate();
  }

  return (
    <ChatContext.Provider
      value={{
        user,
        setUser,
        selectedChat,
        setSelectedChat,
        chats,
        setChats,
        notification,
        setNotification,
        fetchChatsAgain,
        setFetchChatsAgain,
        onlineUsers,
        setOnlineUsers,
        socket,
        setSocket,
        notificationFromBackend,
        setNotificationFromBackend,
        reconnectSocket,
        setReconnectSocket,
        applyBlueTick,
        setApplyBlueTick,
        refetchMessages,
        setRefetchMessages,
        jwtToken,
        setJwtToken,
        handleWebSocketConnection,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const data = useContext(ChatContext);

  if (data === undefined) {
    throw new Error(
      "You are accessing the Context Provider's value object outside its scope !!!"
    );
  }

  return data;
}

export default ChatProvider;

/*
  ^ Logic to connect frontend App. with backend application:-
  
  1] To which endpoint i want to connect:-
     http://localhost:5000/fetch/all/movies
              |           |
              |           |--> API endpoint  
              |
              |--> This backend application is running in your computer(local server) 
                   at port number 5000. 

  2] npm i axios --> Library used to fetch the data from an API.
  3] This endpoint "/fetch/all/movies" is associated with 'get' method.
     
     SO,
     Axios.get("http://localhost:5000/fetch/all/movies")

  4] Now an error occurs:-
     Access to XMLHttpRequest at 'http://localhost:5000/fetch/all/movies' from origin 
    'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin'
     header is present on the requested resource.   

  ! Why is this error happening?
    For security reasons, the browser is blocking the request because your backend '(http://localhost:5000)'
    did not send an 'Access-Control-Allow-Origin' header in the response. 
    
    This header is required to tell the browser that the server permits the request from the frontend's 
    origin '(http://localhost:5173)'.

  * How to fix it?
    To solve this issue, you need to configure your backend to allow 'cross-origin requests'
    from your frontend. 


------------------------------------------------------------------------------------------------------------      
?   Q. What is CORS & Why do we get this error?
 --> 1] CORS (Cross Origin Request Sharing).
     2] React Application is running at Port No. 5173 & React application is connecting with
        backend Application which is running at Port No. 5000.
        
     3] When one application running at one port number, is trying to communicate with
        one more application running at another port number, then that communication
        between them will not be directly possible.
        
        That error only we call it as "CORS".

     4] Your React application is trying to send a request, to an application running at
        different port number.
        
 ~ Now if we want to handle the 'CORS' error, then we should use one library:- cors
   Now once i install this 'cors' library then this problem/error will be solved.
 ^ So to make that communication happen, we'll use 'cors' library.  
   
?   Q. Now in which application you need to install this library ?
---> To which application you are getting connected, always in that application you have
     to install "cors".
     
     So in backend application you need to install this "cors" library.
     (npm i cors)                 

-----------------------------------------------------------------------------------------------------------------

*/

/*
 
 🔧 Step-by-Step Changes to Frontend

    1. Install required packages:
?      npm install @stomp/stompjs sockjs-client

    2. Update 'ChatProvider.js': 
       
       Replace your existing 'useEffect' for 'socket.io' with the following:

       
      This useEffect is setting up a WebSocket connection using STOMP over SockJS, commonly used to 
      integrate with a Spring Boot backend using STOMP messaging

!        useEffect(() => {
!           const stompClient = new Client({
?             webSocketFactory: () => new SockJS(ENDPOINT),
?             reconnectDelay: 5000,
?             debug: (str) => console.log(str),
~             onConnect: () => {
*               console.log("Connected to WebSocket");

               // Save socket client
*               setSocket(stompClient);
~             },
!           });

~           stompClient.activate();

&           return () => {
&              if (stompClient && stompClient.active) {
&                stompClient.deactivate();
&              }
!           };
*        }, [reconnectSocket]);

     🔍 Line-by-Line Explanation

?       'useEffect(() => { ... }, [reconnectSocket]);'

         . 'useEffect' is a React hook that runs side effects after rendering.

         . This effect runs:

            . once on initial mount, and
            . again whenever 'reconnectSocket' changes (to reconnect if toggled).

?       'const stompClient = new Client({ ... })'

         . Client comes from the '@stomp/stompjs' library.

         . It creates a STOMP client instance to handle communication with your backend 
           via WebSockets.

?      'webSocketFactory: () => new SockJS(ENDPOINT)'

        . 'SockJS' is a WebSocket fallback library that supports older browsers or proxy-restricted 
           environments.

        . This line tells 'STOMP' to use 'SockJS' as the transport mechanism to connect to 'ENDPOINT' 
          (http://localhost:5000/ws, for example).

        . 'ENDPOINT' should match what you configured in Spring Boot:
*           registry.addEndpoint("/ws").withSockJS();

?      'reconnectDelay: 5000'

         . If the connection breaks, this tells the client to automatically retry after 5 
           seconds (5000 ms).

  
?      'debug: (str) => console.log(str)'

         . Logs debug information from the STOMP client, helpful for development and troubleshooting 
           connection issues.    

?      'onConnect: () => { ... }'

         . Called once the connection to the server is successfully established.
 
         . You can subscribe to topics or send initial messages here.

         . 'setSocket(stompClient)' saves the connected client to React context or 
            state.

?     'stompClient.activate();'

         . Activates the client and starts the connection handshake with the backend.            
    
?     'return () => { ... }'

         . Cleanup function: called when the component unmounts or 'reconnectSocket' changes.

         . This ensures:

             . the client is properly disconnected,
             . the browser closes the WebSocket cleanly.

         . 'stompClient.active' ensures 'deactivate()' is only called if it was successfully
            connected.

     🧠 Example with Real Values

        Let’s assume:

          . 'ENDPOINT' = "http://localhost:5000/ws"
 
          . Spring Boot has '/ws' endpoint with SockJS enabled.

        Then:

          . React sends STOMP messages via '/app/**' (as per your backend config).

          . Listens for messages on '/topic/**', '/queue/**', or '/user/**'.

      



*/
