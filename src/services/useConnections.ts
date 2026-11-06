import {useEffect,useState} from 'react';
import {checkBackend, personalKey, BackendHealth} from './connection';
import {getAccessToken} from './firebaseAuth';
export function useConnections(){
 const [state,setState]=useState({health:null as BackendHealth|null,drive:false,personal:false,checking:true});
 useEffect(()=>{let alive=true;let generation=0;const refresh=async()=>{const run=++generation;const drive=!!await getAccessToken();let health:BackendHealth|null=null;try{health=await checkBackend();}catch{}if(alive&&run===generation)setState({health,drive,personal:!!personalKey(),checking:false});};refresh();window.addEventListener('connections-changed',refresh);const timer=setInterval(refresh,60000);return()=>{alive=false;clearInterval(timer);window.removeEventListener('connections-changed',refresh);};},[]);
 return {...state,aiLabel:state.health?.geminiConfigured?'Backend AI configured':state.personal?'Personal browser AI':'Local search only',whatsapp:!!(state.health?.whatsappConfigured&&state.health?.webhookSignatureConfigured&&state.health?.whatsappVerifyConfigured)};
}
