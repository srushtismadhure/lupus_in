export type CopdPatientQuickLook = {
	ambulatoryCare: {
		pulmonology: { status: string };
		pulmonaryRehab: { status: string };
		smokingCessation: { smokingStatus?: string; support: string };
		vaccinations: { status: string };
		lungCancerScreening: { status: string };
		recentExacerbation?: { date: string; context: string };
	};
	respiratoryStatus: { spo2?: { value: number | string } };
	exacerbations: { supported: boolean; count: number };
	care: { homeHealth: string };
};
