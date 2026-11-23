import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './delete-account.page.html',
  styleUrls: ['./delete-account.page.scss']
})
export class DeleteAccountPage {}
