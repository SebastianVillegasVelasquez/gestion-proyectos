// import { Navigate } from 'react-router-dom'
// import { useAuth } from '@/features/auth/hooks/useAuth'
//
// interface ProtectedRouteProps {
//     children: React.ReactNode
//     allowedRoles?: Role[]
// }
//
// const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
//     const { user, isAuthenticated } = useAuth()
//
//     if (!isAuthenticated) {
//         return <Navigate to="/login" replace />
//     }
//
//     if (allowedRoles && !allowedRoles.includes(user.role)) {
//         return <Navigate to="/dashboard" replace />  // o a una página 403
//     }
//
//     return <>{children}</>
// }
