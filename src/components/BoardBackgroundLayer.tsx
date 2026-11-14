import React from 'react';
import type { BoardBackgroundType } from '../types/whiteboard.ts';
import { BOARD_BACKGROUNDS } from '../types/whiteboard.ts';

interface BoardBackgroundLayerProps {
  backgroundType: BoardBackgroundType;
  scrollY?: number;
  scrollX?: number;
}

export const BoardBackgroundLayer: React.FC<BoardBackgroundLayerProps> = ({ backgroundType, scrollY = 0, scrollX = 0 }) => {
  const config = BOARD_BACKGROUNDS[backgroundType] || BOARD_BACKGROUNDS['chalkboard-black'];
  const majorSize = (config.gridSize || 32) * 5;
  const offsetX = -(scrollX % majorSize);
  const offsetY = -(scrollY % majorSize);

  return (
    <div 
      className="absolute inset-0 pointer-events-none transition-colors duration-300 overflow-hidden"
      style={{ backgroundColor: config.bgColor }}
    >
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Square Grid Pattern for Math/Science */}
          <pattern 
            id="grid-pattern" 
            width={config.gridSize} 
            height={config.gridSize} 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${offsetX}, ${offsetY})`}
          >
            <path
              d={`M ${config.gridSize} 0 L 0 0 0 ${config.gridSize}`}
              fill="none"
              stroke={config.lineColor}
              strokeWidth="1"
            />
          </pattern>

          {/* Major Grid Pattern (every 5 squares) */}
          <pattern 
            id="major-grid-pattern" 
            width={config.gridSize * 5} 
            height={config.gridSize * 5} 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${offsetX}, ${offsetY})`}
          >
            <path
              d={`M ${config.gridSize * 5} 0 L 0 0 0 ${config.gridSize * 5}`}
              fill="none"
              stroke={config.lineColor}
              strokeWidth="1.5"
            />
          </pattern>

          {/* Lined Pattern */}
          <pattern 
            id="lined-pattern" 
            width="100%" 
            height={config.gridSize} 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${offsetX}, ${offsetY})`}
          >
            <line 
              x1="0" 
              y1={config.gridSize} 
              x2="100%" 
              y2={config.gridSize} 
              stroke={config.lineColor} 
              strokeWidth="1" 
            />
          </pattern>

          {/* Dot Matrix Pattern */}
          <pattern 
            id="dots-pattern" 
            width={config.gridSize} 
            height={config.gridSize} 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${offsetX}, ${offsetY})`}
          >
            <circle cx={config.gridSize / 2} cy={config.gridSize / 2} r="1.25" fill={config.lineColor} />
          </pattern>
        </defs>

        {/* Render Pattern Overlay */}
        {config.pattern === 'grid' && (
          <>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            <rect width="100%" height="100%" fill="url(#major-grid-pattern)" opacity="0.6" />
          </>
        )}

        {config.pattern === 'lined' && (
          <rect width="100%" height="100%" fill="url(#lined-pattern)" />
        )}

        {config.pattern === 'dots' && (
          <rect width="100%" height="100%" fill="url(#dots-pattern)" />
        )}
      </svg>
    </div>
  );
};
