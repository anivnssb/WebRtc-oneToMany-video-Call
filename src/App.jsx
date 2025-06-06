import React, { useEffect } from 'react';
import RemotVideo from './components/remotVideo';
import LocalVideo from './components/localVideo';
import InfoIcon from './components/iIcon';

const WebRTCClient = () => {
  const [hostORClient, setHostORClient] = React.useState('host');
  const [peerConnection, setPeerConnection] = React.useState([]);
  const [inCall, setInCall] = React.useState(false);
  const [waitingForPeer, setWaitingForPeer] = React.useState(false);
  const [remoteStreams, setRemoteStreams] = React.useState([]);

  const localVideoRef = React.useRef(null);

  const [offer, setOffer] = React.useState([]);
  const [answer, setAnswer] = React.useState([]);

  useEffect(() => {
    createPeerConnection();
  }, []);

  function registerPeerConnectionListeners(peerConnection) {
    // Register event listeners for the peer connection
    peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`
      );
    });

    peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);

      switch (peerConnection.connectionState) {
        case 'connecting':
          setWaitingForPeer(true);
          break;

        case 'connected':
          setInCall(true);
          setWaitingForPeer(false);
          break;

        case 'disconnected':
          peerConnection.close();
          setInCall(false);
          setOffer([]);
          setAnswer([]);
          setRemoteStreams([]);
          createPeerConnection();
          console.log('Disconnected from peer');
          break;
      }
    });

    peerConnection.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
      console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`
      );
    });
  }

  const createpeerConnectionForRemote = async () => {
    // This function is used to create a new peer connection for new remote video streams
    const pc = new RTCPeerConnection();
    registerPeerConnectionListeners(pc);

    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    } else {
      throw new Error(
        'Local stream is not available, please check your camera and microphone'
      );
    }
    pc.ontrack = async (event) => {
      const remoteStream = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      setRemoteStreams((prevStreams) => [...prevStreams, remoteStream]);
    };
    setPeerConnection((prev) => [...prev, pc]);
  };
  const createPeerConnection = async () => {
    // This function is used to create a new peer connection for the firt time
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    //  Update video streams in the DOM
    localVideoRef.current.srcObject = localStream;

    //	create peer connection
    const pc = new RTCPeerConnection();
    registerPeerConnectionListeners(pc);

    //  Push tracks from local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    } else {
      throw new Error(
        'Local stream is not available, please check your camera and microphone'
      );
    }

    //  Pull tracks from remote stream, add to video stream in DOM
    // if (remoteStream) {
    pc.ontrack = async (event) => {
      const remoteStream = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      setRemoteStreams((prevStreams) => [...prevStreams, remoteStream]);
    };

    setPeerConnection([pc]);
  };

  const generateIceCandidate = async (peerType) => {
    if (!peerConnection[peerConnection.length - 1]) {
      throw new Error('Peer connection is not available');
    }
    peerConnection[peerConnection.length - 1].onicecandidate = (event) => {
      if (event.candidate) {
        //  when ice candidate is received, we'll update the offer and answer sdp and then send it back to the caller and callee
        if (peerType === 'caller') {
          setOffer((prev) => [
            ...prev,
            peerConnection[peerConnection.length - 1]?.localDescription,
          ]);
        } else if (peerType === 'receiver') {
          setAnswer((prev) => [
            ...prev,
            peerConnection[peerConnection.length - 1]?.localDescription,
          ]);
        } else {
          throw new Error(
            'Peer type is not available, please look into generating ice candidate'
          );
        }
      }
    };
  };

  const hangup = async () => {
    // end the meeting for all clients
    if (!peerConnection[peerConnection.length - 1]) {
      setInCall(false);
      setOffer([]);
      setAnswer([]);
      setRemoteStreams([]);

      createPeerConnection();
      throw new Error('Peer connection is not available');
    }
    for (const pc of peerConnection) {
      await pc.close();
    }
    setInCall(false);
    setOffer([]);
    setAnswer([]);
    setRemoteStreams([]);

    createPeerConnection();
  };
  const hangupRemote = async (index) => {
    //end call with client
    if (!peerConnection[index]) {
      throw new Error('Peer connection is not available');
    }
    await peerConnection[index].close();
    const offerCopy = [...offer];
    offerCopy.splice(index, 1);
    setOffer(offerCopy);

    const answerCopy = [...answer];
    answerCopy.splice(index, 1);
    setAnswer(answerCopy);

    const updatedRemoteStreams = [...remoteStreams];
    updatedRemoteStreams.splice(index, 1);
    setRemoteStreams(updatedRemoteStreams);
    const peerConnectionCopy = [...peerConnection];
    peerConnectionCopy.splice(index, 1);
    setPeerConnection(peerConnectionCopy);
    console.log('Remote connection closed');
  };

  const startCall = async () => {
    //********for host only********
    if (!peerConnection[peerConnection.length - 1]) {
      throw new Error('Peer connection is not available');
    }

    await generateIceCandidate('caller');

    const offerDescription = await peerConnection[
      peerConnection.length - 1
    ].createOffer();
    await peerConnection[peerConnection.length - 1].setLocalDescription(
      offerDescription
    );

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    setOffer((prev) => [...prev, offer]);
  };

  const onAnswer = async (answer) => {
    //********for host only********
    if (!peerConnection[peerConnection.length - 1]) {
      throw new Error('Peer connection is not available');
    }

    if (peerConnection[peerConnection.length - 1].currentRemoteDescription) {
      console.log('Remote description already set');
      return;
    }

    const answerDescription = new RTCSessionDescription(answer);
    await peerConnection[peerConnection.length - 1].setRemoteDescription(
      answerDescription
    );
    setInCall(true);
  };

  const answerCall = async () => {
    //********for client only********

    try {
      await generateIceCandidate('receiver');
      console.log(offer);
      const offerr = await JSON.parse(offer[offer.length - 1]);
      const offerDescription = new RTCSessionDescription(offerr);
      await peerConnection[peerConnection.length - 1].setRemoteDescription(
        offerDescription
      );

      const answerDescription = await peerConnection[
        peerConnection.length - 1
      ].createAnswer();
      await peerConnection[peerConnection.length - 1].setLocalDescription(
        answerDescription
      );

      const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
      };

      console.log('answer created', answer);
      setAnswer((prev) => [...prev, answer]);
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: '2em',
        margin: '20px',
      }}
    >
      <h3>start by selecting host or client</h3>
      <div style={{ display: 'flex' }}>
        <input
          type="radio"
          id="host"
          name="clientOrHost"
          value="host"
          onChange={() => setHostORClient('host')}
        />
          <label for="host">Host</label> {' '}
        <input
          type="radio"
          id="client"
          name="clientOrHost"
          value="client"
          onChange={() => setHostORClient('client')}
        />
          <label for="client">Client</label>
      </div>

      <h1>{peerConnection[0]?.connectionState ?? 'no state'}</h1>

      {waitingForPeer && (
        <center>
          <h2> waiting for peer to respond... </h2>
        </center>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <LocalVideo
          {...{
            localVideoRef,
            offer,
            setOffer,
            hostORClient,
            startCall,
            answerCall,
            inCall,
            hangup,
            answer,
            setAnswer,
            onAnswer,
          }}
        />
        {remoteStreams.length
          ? remoteStreams.map((stream, index) => (
              <>
                <RemotVideo
                  {...{
                    stream,
                    index,
                    hangupRemote,
                    hostORClient,
                  }}
                />
                {remoteStreams.length - 1 === index &&
                hostORClient === 'host' ? (
                  <button
                    style={{ width: 'fit-content', height: 'fit-content' }}
                    onClick={() => {
                      setAnswer((prev) => [...prev, 'new remote video']);
                      createpeerConnectionForRemote();
                    }}
                  >
                    Add new client{' '}
                    <span className="tooltip">
                      <InfoIcon />
                      <span className="tooltiptext">
                        Use this button to add new client to the meeting, click
                        this button and then click the startCall button
                      </span>
                    </span>
                  </button>
                ) : (
                  ''
                )}
              </>
            ))
          : ''}
      </div>
    </div>
  );
};

export default WebRTCClient;
