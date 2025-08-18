import React, { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface CarouselProps {
  children: React.ReactNode
  className?: string
  itemWidth?: number
  gap?: number
  showArrows?: boolean
}

export function Carousel({ 
  children, 
  className, 
  itemWidth = 200, 
  gap = 16, 
  showArrows = true 
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScrollability = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScrollability()
    const handleResize = () => checkScrollability()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [children])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = itemWidth + gap
      const newScrollLeft = direction === 'left' 
        ? scrollRef.current.scrollLeft - scrollAmount * 3
        : scrollRef.current.scrollLeft + scrollAmount * 3

      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className={cn("relative group", className)}>
      {showArrows && canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide space-x-4 pb-2"
        style={{ gap: `${gap}px` }}
        onScroll={checkScrollability}
      >
        {children}
      </div>

      {showArrows && canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

interface CarouselItemProps {
  children: React.ReactNode
  className?: string
  width?: number
}

export function CarouselItem({ children, className, width = 200 }: CarouselItemProps) {
  return (
    <div 
      className={cn("flex-shrink-0", className)}
      style={{ width: `${width}px` }}
    >
      {children}
    </div>
  )
}
