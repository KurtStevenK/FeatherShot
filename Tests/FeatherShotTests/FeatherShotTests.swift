import Foundation
import Testing
@testable import FeatherShot

private struct LetterLabelCase: Decodable {
    let n: Int
    let label: String
}

@Test func letterLabelMatchesSharedFixture() throws {
    let url = try #require(Bundle.module.url(forResource: "letterLabel.cases", withExtension: "json"))
    let data = try Data(contentsOf: url)
    let cases = try JSONDecoder().decode([LetterLabelCase].self, from: data)

    for entry in cases {
        #expect(letterLabel(entry.n) == entry.label)
    }
}
