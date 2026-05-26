import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import {
  AI_PROVIDERS,
  AiProviderError,
} from './providers/ai-provider.interface';
import { AiUsageService } from './ai-usage.service';
import { EventBusService } from '../events/event-bus.service';
import { SettingsService } from '../settings/settings.service';
import { AiProvider, AiOperation } from '@jitre/shared';
import { AiFeatureDisabledException } from './exceptions/ai-feature-disabled.exception';
import { AiRequestMadeEvent } from './events/ai-request-made.event';
import { AiRequestFailedEvent } from './events/ai-request-failed.event';

const mockGeminiProvider = {
  name: AiProvider.GEMINI,
  generateCompletion: jest.fn(),
  generateStream: jest.fn(),
  embed: jest.fn(),
};

const mockAnthropicProvider = {
  name: AiProvider.ANTHROPIC,
  generateCompletion: jest.fn(),
  generateStream: jest.fn(),
  embed: jest.fn(),
};

const mockUsageService = {
  record: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

const mockSettings = {
  getAiSetting: jest.fn(),
};

describe('AiService', () => {
  let service: AiService;

  const opts = {
    workspaceId: 'ws-1',
    userId: 'u-1',
    operation: AiOperation.DESCRIBE,
    request: { userPrompt: 'Describe this task' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AI_PROVIDERS,
          useValue: [mockGeminiProvider, mockAnthropicProvider],
        },
        { provide: AiUsageService, useValue: mockUsageService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('generateCompletion — happy path', () => {
    beforeEach(() => {
      mockSettings.getAiSetting.mockImplementation((_, key: string) => {
        if (key === 'ai.enabled') return Promise.resolve(true);
        if (key === 'ai.provider') return Promise.resolve(AiProvider.GEMINI);
        return Promise.resolve(null);
      });

      mockGeminiProvider.generateCompletion.mockResolvedValue({
        text: 'Generated description',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        model: 'gemini-2.0-flash-exp',
        finishReason: 'stop',
      });

      mockUsageService.record.mockResolvedValue({ id: 'rec-1' });
    });

    it('returns response with costUsd', async () => {
      const result = await service.generateCompletion(opts);
      expect(result.text).toBe('Generated description');
      expect(typeof result.costUsd).toBe('string');
    });

    it('calls provider.generateCompletion with the request', async () => {
      await service.generateCompletion(opts);
      expect(mockGeminiProvider.generateCompletion).toHaveBeenCalledWith(
        opts.request,
      );
    });

    it('records usage with success=true', async () => {
      await service.generateCompletion(opts);
      expect(mockUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          workspaceId: 'ws-1',
          userId: 'u-1',
        }),
      );
    });

    it('publishes AiRequestMadeEvent', async () => {
      await service.generateCompletion(opts);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(AiRequestMadeEvent),
      );
    });

    it('resolves provider from provider setting', async () => {
      await service.generateCompletion(opts);
      expect(mockSettings.getAiSetting).toHaveBeenCalledWith(
        'ws-1',
        'ai.provider',
        AiProvider.GEMINI,
      );
    });
  });

  describe('generateCompletion — kill switch', () => {
    it('throws AiFeatureDisabledException when ai.enabled=false', async () => {
      mockSettings.getAiSetting.mockImplementation((_, key: string) => {
        if (key === 'ai.enabled') return Promise.resolve(false);
        return Promise.resolve(AiProvider.GEMINI);
      });

      await expect(service.generateCompletion(opts)).rejects.toBeInstanceOf(
        AiFeatureDisabledException,
      );
    });
  });

  describe('generateCompletion — unknown provider', () => {
    it('throws BadRequestException for unknown provider', async () => {
      mockSettings.getAiSetting.mockImplementation((_, key: string) => {
        if (key === 'ai.enabled') return Promise.resolve(true);
        if (key === 'ai.provider')
          return Promise.resolve('UNKNOWN_PROVIDER' as AiProvider);
        return Promise.resolve(null);
      });

      await expect(service.generateCompletion(opts)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('generateCompletion — error path', () => {
    beforeEach(() => {
      mockSettings.getAiSetting.mockImplementation((_, key: string) => {
        if (key === 'ai.enabled') return Promise.resolve(true);
        if (key === 'ai.provider') return Promise.resolve(AiProvider.GEMINI);
        return Promise.resolve(null);
      });
    });

    it('records usage with success=false when provider throws', async () => {
      const provErr = new AiProviderError(
        AiProvider.GEMINI,
        'RATE_LIMITED',
        'Too many',
        true,
      );
      mockGeminiProvider.generateCompletion.mockRejectedValue(provErr);
      mockUsageService.record.mockResolvedValue({ id: 'rec-2' });

      await expect(service.generateCompletion(opts)).rejects.toThrow();

      expect(mockUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, errorCode: 'RATE_LIMITED' }),
      );
    });

    it('publishes AiRequestFailedEvent on provider error', async () => {
      const provErr = new AiProviderError(
        AiProvider.GEMINI,
        'RATE_LIMITED',
        'Too many',
        true,
      );
      mockGeminiProvider.generateCompletion.mockRejectedValue(provErr);
      mockUsageService.record.mockResolvedValue({ id: 'rec-2' });

      await expect(service.generateCompletion(opts)).rejects.toThrow();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(AiRequestFailedEvent),
      );
    });

    it('re-throws the original error', async () => {
      const provErr = new AiProviderError(
        AiProvider.GEMINI,
        'RATE_LIMITED',
        'Too many',
        true,
      );
      mockGeminiProvider.generateCompletion.mockRejectedValue(provErr);
      mockUsageService.record.mockResolvedValue({ id: 'rec-2' });

      await expect(service.generateCompletion(opts)).rejects.toBe(provErr);
    });

    it('uses UNKNOWN errorCode when error is not AiProviderError', async () => {
      const genericErr = new Error('Unexpected');
      mockGeminiProvider.generateCompletion.mockRejectedValue(genericErr);
      mockUsageService.record.mockResolvedValue({ id: 'rec-3' });

      await expect(service.generateCompletion(opts)).rejects.toThrow();

      expect(mockUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, errorCode: 'UNKNOWN' }),
      );
    });
  });
});
