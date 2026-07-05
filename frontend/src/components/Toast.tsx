import React from 'react'

interface Props {
  message: string
  className?: string
}

const Toast: React.FC<Props> = ({ message, className }) => {
  return (
    <div className={`${className} visible`}>
      {message}
    </div>
  )
}

export default Toast