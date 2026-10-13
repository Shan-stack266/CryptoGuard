const kinds = { activity:'cg_events',account:'cg_account_logs',security:'cg_events',model:'cg_events',alerts:'cg_alerts',cipher:'cg_cipher_history' }
export function logQuery(params, user, admin) {
  const kind=params.get('kind') ?? 'activity', table=kinds[kind]
  if(!table)throw Object.assign(new Error('Invalid log category.'),{status:400})
  if(!admin&&['account','security','model','alerts'].includes(kind))throw Object.assign(new Error('Administrator role required.'),{status:403})
  const page=Number(params.get('page')??1),size=Number(params.get('size')??20)
  if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(size)||size<1||size>100)throw Object.assign(new Error('Invalid pagination.'),{status:400})
  const filters=admin?{}:{user_id:user.id}
  const event=params.get('event')
  if(event){if(!/^[0-9a-f-]{36}$/i.test(event))throw Object.assign(new Error('Invalid event ID.'),{status:400});filters.id=event}
  const operation=params.get('operation'),status=params.get('status')
  if(operation)filters.operation=operation
  if(status)filters[table==='cg_alerts'?'status':'decision']=status
  const start=params.get('start'),end=params.get('end')
  for(const value of [start,end])if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Object.assign(new Error('Invalid date filter.'),{status:400})
  if(start&&end&&start>end)throw Object.assign(new Error('From date must not be after To date.'),{status:400})
  const search=(params.get('search')??'').trim()
  if(search.length>100)throw Object.assign(new Error('Search must contain at most 100 characters.'),{status:400})
  // UTC boundaries are explicit to make database filtering unambiguous.
  return {table,kind,filters,page,size,search,start:start?`${start}T00:00:00Z`:null,end:end?`${end}T23:59:59.999Z`:null}
}
