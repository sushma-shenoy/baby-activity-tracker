import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeleteAccountPage } from './delete-account.page';

describe('DeleteAccountPage', () => {
  let fixture: ComponentFixture<DeleteAccountPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteAccountPage],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteAccountPage);
    fixture.detectChanges();
  });

  it('provides public account deletion instructions', () => {
    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Delete your Gigglebean account');
    expect(content).toContain('Data that is deleted');
    expect(content).toContain('gigglebean.app@gmail.com');
  });
});
