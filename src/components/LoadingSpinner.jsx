import { Briefcase } from 'lucide-react'
import React from 'react'

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
         <div className='text-center'>
            <div className='relative'>
                <div className='animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4 '></div>
                    <div className='absolute inset-0 flex items-center justify-center'>
                        <Briefcase className='text-blue-600 7-6 w-7' />
                    </div>
                </div>
                <p className='mt-4 text-lg font-medium text-gray-700'>Finding amazing opportunities....</p>

         </div>
    </div>
  )
}

export default LoadingSpinner