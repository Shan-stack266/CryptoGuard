const paths = {
  Activity: 'M22 12h-4l-3 8L9 4l-3 8H2',
  AlertTriangle: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  CheckCircle: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.01l-3-3',
  Cpu: 'M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3M7 7h10v10H7z',
  Eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  Flame: 'M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-1 3-2 4 0-4-2-7-5-10 1 5-4 7-4 13 0 4 4 7 8 7Z',
  Key: 'M21 2l-2 2m-7.6 7.6a5 5 0 1 1-3-3L21 2l1 5-5-1-1 5-4.6.6Z',
  Lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  RefreshCw: 'M21 12a9 9 0 0 1-15.5 6.2L3 16m0 0v5h5M3 12A9 9 0 0 1 18.5 5.8L21 8m0 0V3h-5',
  Shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  Support: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zm13 0h3v5h-3zm0 5c0 2-2 3-5 3h-1',
  Terminal: 'm4 17 6-5-6-5m8 10h8',
  Unlock: 'M7 11V7a5 5 0 0 1 9.7-1.7M5 11h14v10H5z',
  User: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

export const Activity = () => <Icon name="Activity" />
export const AlertTriangle = () => <Icon name="AlertTriangle" />
export const CheckCircle = () => <Icon name="CheckCircle" />
export const Cpu = () => <Icon name="Cpu" />
export const Eye = () => <Icon name="Eye" />
export const Flame = () => <Icon name="Flame" />
export const Key = () => <Icon name="Key" />
export const Lock = () => <Icon name="Lock" />
export const RefreshCw = () => <Icon name="RefreshCw" />
export const Shield = () => <Icon name="Shield" />
export const Support = () => <Icon name="Support" />
export const Terminal = () => <Icon name="Terminal" />
export const Unlock = () => <Icon name="Unlock" />
export const User = () => <Icon name="User" />
