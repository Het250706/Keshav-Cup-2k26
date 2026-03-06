import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

// Define type for safety
type Player = {
    name: string | null;
    role: string | null;
    category: string | null;
    sold_price: number | null;
    teams?: {
        name: string | null;
    } | null;
};

export async function exportAuctionSummary(): Promise<void> {
    try {
        // Fetch sold players with team name
        const { data, error } = await supabase
            .from('players')
            .select(`
                name,
                role,
                category,
                sold_price,
                teams (
                    name
                )
            `)
            .eq('is_sold', true)
            .order('sold_price', { ascending: false });

        if (error) {
            console.error('Supabase error:', error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.warn('No sold players found.');
            return;
        }

        const players: Player[] = data as any;

        // Create PDF
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.setTextColor(0, 0, 0);
        doc.text('Cricket Auction 2026 - Summary Report', 14, 20);

        // Generated date
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // Calculate total revenue
        const totalRevenue = players.reduce(
            (sum, p) => sum + Number(p.sold_price || 0),
            0
        );

        doc.text(
            `Total Revenue: ₹ ${(totalRevenue / 10000000).toFixed(2)} Cr`,
            14,
            35
        );

        // Table
        autoTable(doc, {
            startY: 45,
            head: [['Player Name', 'Role', 'Category', 'Team', 'Price (Cr)']],
            body: players.map((p) => [
                p.name ?? 'N/A',
                p.role ?? 'N/A',
                p.category ?? 'N/A',
                p.teams?.name ?? 'N/A',
                `₹ ${((p.sold_price || 0) / 10000000).toFixed(2)} Cr`
            ]),
            styles: {
                fontSize: 10
            },
            headStyles: {
                fillColor: [0, 75, 160],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            columnStyles: {
                4: { halign: 'right' }
            }
        });

        // Save PDF
        doc.save('auction-summary-2026.pdf');

        console.log('PDF generated successfully');

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}
