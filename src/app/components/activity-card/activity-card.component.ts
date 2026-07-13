import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-activity-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-card.component.html',
  styleUrls: ['./activity-card.component.scss'],
})
export class ActivityCardComponent {
  @Input() icon = '📝';
  @Input() title = '';
  @Input() value = '';
  @Input() time = '';
}