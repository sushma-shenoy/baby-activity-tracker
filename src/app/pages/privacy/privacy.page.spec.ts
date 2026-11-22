import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyPage } from './privacy.page';

describe('PrivacyPage', () => {
  let component: PrivacyPage;
  let fixture: ComponentFixture<PrivacyPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPage],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the public privacy policy page', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Privacy Policy');
    expect(fixture.nativeElement.textContent).toContain('gigglebean.app@gmail.com');
  });
});
