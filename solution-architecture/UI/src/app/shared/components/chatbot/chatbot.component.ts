import { Component, inject, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatChoice, ChatChoiceData, ChatResultData } from '../../../core/services/chatbot.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss'
})
export class ChatbotComponent {
  private readonly chatbot = inject(ChatbotService);
  readonly langSvc = inject(LanguageService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  readonly isOpen       = signal(false);
  readonly userInput    = signal('');
  readonly messages     = this.chatbot.messages;
  readonly isProcessing = this.chatbot.isProcessing;

  constructor() {
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  toggleChat(): void { this.isOpen.update(v => !v); }

  async sendMessage(): Promise<void> {
    const msg = this.userInput().trim();
    if (!msg || this.isProcessing()) return;
    this.userInput.set('');
    await this.chatbot.sendMessage(msg);
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  handleChoice(choice: ChatChoice): void {
    this.chatbot.handleChoice(choice);
  }

  setQuickInput(text: string): void { this.userInput.set(text); }

  clearChat(): void { this.chatbot.clearChat(); }

  asResultData(data: any): ChatResultData  { return data as ChatResultData; }
  asChoiceData(data: any): ChatChoiceData  { return data as ChatChoiceData; }

  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    }
  }
}
