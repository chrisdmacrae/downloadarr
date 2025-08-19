import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { GamePlatformsService, GamePlatform, PlatformCategory } from './game-platforms.service';

@ApiTags('Game Platforms')
@Controller('game-platforms')
export class GamePlatformsController {
  constructor(private readonly gamePlatformsService: GamePlatformsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get all game platforms',
    description: 'Retrieve all supported game platforms with their details'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all game platforms',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'pc' },
              name: { type: 'string', example: 'PC' },
              category: { type: 'string', example: 'pc' },
              description: { type: 'string', example: 'Windows PC games' },
              aliases: { type: 'array', items: { type: 'string' }, example: ['windows', 'win'] }
            }
          }
        }
      }
    }
  })
  getAllPlatforms() {
    return {
      success: true,
      data: this.gamePlatformsService.getAllPlatforms()
    };
  }

  @Get('categories')
  @ApiOperation({ 
    summary: 'Get all platform categories',
    description: 'Retrieve all platform categories for organizing platforms'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all platform categories',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'nintendo' },
              name: { type: 'string', example: 'Nintendo' },
              description: { type: 'string', example: 'Nintendo gaming platforms' }
            }
          }
        }
      }
    }
  })
  getAllCategories() {
    return {
      success: true,
      data: this.gamePlatformsService.getAllCategories()
    };
  }

  @Get('options')
  @ApiOperation({ 
    summary: 'Get platform options for dropdowns',
    description: 'Get simplified platform options suitable for frontend dropdowns'
  })
  @ApiQuery({ 
    name: 'grouped', 
    required: false, 
    type: 'boolean',
    description: 'Whether to group options by category'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Platform options for dropdowns'
  })
  getPlatformOptions(@Query('grouped') grouped?: string) {
    const isGrouped = grouped === 'true';
    
    return {
      success: true,
      data: isGrouped 
        ? this.gamePlatformsService.getGroupedPlatformOptions()
        : this.gamePlatformsService.getPlatformOptions()
    };
  }

  @Get('search')
  @ApiOperation({ 
    summary: 'Search platforms',
    description: 'Search for platforms by name, ID, or alias'
  })
  @ApiQuery({ 
    name: 'q', 
    required: true, 
    type: 'string',
    description: 'Search query'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Matching platforms'
  })
  searchPlatforms(@Query('q') query: string) {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      };
    }

    return {
      success: true,
      data: this.gamePlatformsService.searchPlatforms(query)
    };
  }

  @Get('category/:categoryId')
  @ApiOperation({ 
    summary: 'Get platforms by category',
    description: 'Retrieve all platforms belonging to a specific category'
  })
  @ApiParam({ 
    name: 'categoryId', 
    type: 'string',
    description: 'Category ID (e.g., nintendo, playstation, xbox)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Platforms in the specified category'
  })
  getPlatformsByCategory(@Param('categoryId') categoryId: string) {
    const platforms = this.gamePlatformsService.getPlatformsByCategory(categoryId);
    
    return {
      success: true,
      data: platforms
    };
  }

  @Get(':platformId')
  @ApiOperation({ 
    summary: 'Get platform by ID',
    description: 'Retrieve details for a specific platform'
  })
  @ApiParam({ 
    name: 'platformId', 
    type: 'string',
    description: 'Platform ID (e.g., pc, nintendo-switch, ps5)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Platform details'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Platform not found'
  })
  getPlatformById(@Param('platformId') platformId: string) {
    const platform = this.gamePlatformsService.getPlatformById(platformId);
    
    if (!platform) {
      return {
        success: false,
        error: 'Platform not found'
      };
    }

    return {
      success: true,
      data: platform
    };
  }
}
