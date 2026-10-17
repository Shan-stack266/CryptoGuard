import {useState} from 'react'
import {useAuth} from '../context/AuthContext.jsx'
export default function ProfileSettings(){
 const auth=useAuth(),[name,setName]=useState(auth.user.display_name??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 return<form className="dashboard-panel security-form security-view" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await auth.updateProfile(name);setMessage('Profile saved.')}catch(failure){setError(failure.message)}finally{setBusy(false)}}}><h2>Your profile</h2><p>{auth.user.email} - {auth.user.role}</p>{auth.user.full_name&&<p>Full name: {auth.user.full_name}</p>}{auth.user.username&&<p>Username: @{auth.user.username}</p>}<label>Display name<input maxLength={100} autoComplete="name" value={name} onChange={event=>setName(event.target.value)}/></label><button type="submit" disabled={busy}>Save profile</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</form>
}

